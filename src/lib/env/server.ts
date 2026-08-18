import "server-only";
import { z } from "zod";
import { publicEnv } from "./public";

// Fails fast with one aggregated, human-readable error on first import,
// instead of letting a missing/malformed secret surface later as an opaque
// error deep inside a provider SDK or crypto call (§11: env var validation;
// §17: server-side secrets, never exposed to the client — this module is
// import "server-only" guarded so bundlers refuse to pull it into client code).
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  // AES-256-GCM key for the BYOK session cookie (lib/security/crypto.ts) —
  // must decode to exactly 32 bytes, e.g. `openssl rand -base64 32`.
  BYOK_ENCRYPTION_KEY: z
    .string()
    .min(1)
    .refine((v) => {
      try {
        return Buffer.from(v, "base64").length === 32;
      } catch {
        return false;
      }
    }, "must be base64 that decodes to exactly 32 bytes (openssl rand -base64 32)"),
  DRAFT_TOKEN_SECRET: z.string().min(1),
  // Optional: the cron route (src/app/api/cron/daily/route.ts) treats an
  // unset value as "reject every request" (fail closed), not as "skip auth".
  CRON_SECRET: z.string().min(1).optional(),
});

function parse() {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    BYOK_ENCRYPTION_KEY: process.env.BYOK_ENCRYPTION_KEY,
    DRAFT_TOKEN_SECRET: process.env.DRAFT_TOKEN_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid or missing server environment variables:\n${issues}`);
  }
  return parsed.data;
}

/** Validated environment — public vars plus server-only secrets. */
export const env = { ...publicEnv, ...parse() };
