import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { evaluateAndProposeReplans } from "@/server/actions/replan";
import { advanceCurrentWeek } from "@/server/actions/plan";
import { env } from "@/lib/env/server";

/**
 * §8.3 scheduled work — service-role authenticated, once daily. No AI runs
 * unconditionally here: `evaluateAndProposeReplans` only calls the `replan`
 * module for a goal whose signals actually trip a trigger (see
 * `src/server/actions/replan.ts`'s doc comment on that deviation).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const { data: goals, error } = await db.from("goals").select("id, user_id").eq("status", "active");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Array<{ goalId: string; triggers?: string[]; rollover?: boolean; error?: string }> = [];

  for (const goal of goals ?? []) {
    try {
      const triggers = await evaluateAndProposeReplans(db, goal.id, goal.user_id);
      const rollover = await advanceCurrentWeek(db, goal.id, goal.user_id);
      results.push({ goalId: goal.id, triggers: triggers.map((t) => t.kind), rollover: rollover.advanced });
    } catch (err) {
      results.push({ goalId: goal.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ processedGoals: results.length, results });
}
