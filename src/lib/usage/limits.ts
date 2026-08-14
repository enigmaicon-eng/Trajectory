import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types.generated";
import { QuotaExceededError } from "@/lib/ai/errors";

// §9 free-tier limits: heavy 8 / rolling 30 days, light 20 / day.
// Starting guess per open assumption #12 — tune from ai_runs cost data.
const LIMITS = { light: 20, heavy: 8 } as const;
const HEAVY_WINDOW_DAYS = 30;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function checkAndIncrementUsage(
  db: SupabaseClient<Database>,
  userId: string,
  moduleClass: "light" | "heavy",
): Promise<void> {
  const today = todayUtc();

  if (moduleClass === "light") {
    const { data } = await db
      .from("usage_counters")
      .select("count")
      .eq("user_id", userId)
      .eq("period_start", today)
      .eq("module_class", "light")
      .maybeSingle();

    if ((data?.count ?? 0) >= LIMITS.light) {
      const resetsAt = new Date();
      resetsAt.setUTCHours(24, 0, 0, 0);
      throw new QuotaExceededError("light", resetsAt);
    }
  } else {
    const windowStart = new Date();
    windowStart.setUTCDate(windowStart.getUTCDate() - HEAVY_WINDOW_DAYS);

    const { data } = await db
      .from("usage_counters")
      .select("count")
      .eq("user_id", userId)
      .eq("module_class", "heavy")
      .gte("period_start", windowStart.toISOString().slice(0, 10));

    const total = (data ?? []).reduce((sum, row) => sum + row.count, 0);
    if (total >= LIMITS.heavy) {
      const resetsAt = new Date(windowStart);
      resetsAt.setUTCDate(resetsAt.getUTCDate() + HEAVY_WINDOW_DAYS);
      throw new QuotaExceededError("heavy", resetsAt);
    }
  }

  await db.rpc("increment_usage_counter", {
    p_user_id: userId,
    p_period_start: today,
    p_module_class: moduleClass,
  });
}
