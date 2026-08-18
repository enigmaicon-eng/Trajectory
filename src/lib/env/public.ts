import { z } from "zod";

// No "server-only" guard here deliberately: NEXT_PUBLIC_* vars are inlined
// into the browser bundle by Next.js at build time (it replaces the literal
// `process.env.NEXT_PUBLIC_X` expression below), so this module must be safe
// to import from client code (see lib/db/client.ts). Server secrets live in
// ./server.ts instead, which is import "server-only" guarded.
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("must be a valid URL, e.g. https://xyz.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

function parse() {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid or missing public environment variables:\n${issues}`);
  }
  return parsed.data;
}

/** Validated NEXT_PUBLIC_* variables. Safe to import from client components. */
export const publicEnv = parse();
