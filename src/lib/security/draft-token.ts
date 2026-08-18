import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env/server";

// Pre-auth goal drafts have nowhere to live in Postgres — every drafts-adjacent
// table (goals, goal_intake, feasibility_assessments) FKs to auth.users, and
// the user doesn't exist yet during onboarding (§6.2: assess runs before the
// auth gate). So the draft is carried entirely in a signed, httpOnly cookie
// instead of a server-side record. Cheap to revisit if a real store is added.
const COOKIE_NAME = "trajectory_draft";
const MAX_AGE_SECONDS = 60 * 30;

function sign(payload: string): string {
  return createHmac("sha256", env.DRAFT_TOKEN_SECRET).update(payload).digest("base64url");
}

export function encodeDraftToken(data: unknown): string {
  const payload = Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeDraftToken<T>(token: string): T | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export const draftCookie = {
  name: COOKIE_NAME,
  maxAgeSeconds: MAX_AGE_SECONDS,
};
