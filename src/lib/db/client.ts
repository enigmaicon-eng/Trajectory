import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types.generated";
import { publicEnv } from "@/lib/env/public";

export function createClient() {
  return createBrowserClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
