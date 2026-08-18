import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types.generated";
import { publicEnv } from "@/lib/env/public";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // called from a Server Component; middleware refreshes the session instead
          }
        },
      },
    },
  );
}
