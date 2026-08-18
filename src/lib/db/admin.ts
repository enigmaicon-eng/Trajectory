import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.generated";
import { env } from "@/lib/env/server";

// Service-role client. Bypasses RLS — use only in trusted server contexts
// (cron jobs, BYOK credential decryption). Never expose to a request path
// that echoes data back without an explicit ownership check.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
