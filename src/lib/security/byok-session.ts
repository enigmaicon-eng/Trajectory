import "server-only";
import { cookies } from "next/headers";
import { encrypt, decrypt } from "./crypto";

// Project memory "ai-provider-strategy": the user redirected BYOK away from
// §10's encrypted-at-rest `user_credentials` design. A BYOK key here lives
// only in an encrypted, httpOnly, browser-session-lifetime cookie (no
// `maxAge` — cleared when the browser closes) and is never written to
// Postgres. `user_credentials` remains in the schema but unused by v1.
export type ByokProvider = "gemini" | "openai" | "anthropic";

const COOKIE_PREFIX = "trajectory_byok_";
const PROVIDERS: ByokProvider[] = ["gemini", "openai", "anthropic"];

function cookieName(provider: ByokProvider): string {
  return `${COOKIE_PREFIX}${provider}`;
}

export async function setByokKey(provider: ByokProvider, apiKey: string): Promise<void> {
  const store = await cookies();
  store.set(cookieName(provider), encrypt(apiKey), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function clearByokKey(provider: ByokProvider): Promise<void> {
  const store = await cookies();
  store.delete(cookieName(provider));
}

export async function getByokKey(provider: ByokProvider): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(cookieName(provider))?.value;
  return raw ? decrypt(raw) : null;
}

export interface ByokStatus {
  provider: ByokProvider;
  keyHint: string;
}

/** For `/settings/ai`: which providers currently have a key set, last-4-only. */
export async function listByokStatus(): Promise<ByokStatus[]> {
  const store = await cookies();
  const results: ByokStatus[] = [];
  for (const provider of PROVIDERS) {
    const raw = store.get(cookieName(provider))?.value;
    if (!raw) continue;
    const key = decrypt(raw);
    if (key) results.push({ provider, keyHint: `····${key.slice(-4)}` });
  }
  return results;
}
