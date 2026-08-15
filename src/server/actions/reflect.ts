"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { runReflect } from "@/lib/ai/modules/reflect";
import type { Json } from "@/lib/db/types.generated";

const submitReflectionSchema = z.object({
  goalId: z.string().uuid(),
  planWeekId: z.string().uuid(),
  whatWorked: z.string().max(1000).optional(),
  whatDidnt: z.string().max(1000).optional(),
  blockers: z.string().max(1000).optional(),
});

/** AC-7.24: submitting a reflection produces a synthesis with >=1 concrete recommendation. */
export async function submitReflection(input: z.infer<typeof submitReflectionSchema>) {
  const parsed = submitReflectionSchema.parse(input);
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: goal, error: goalError } = await db
    .from("goals")
    .select("outcome_statement, domain")
    .eq("id", parsed.goalId)
    .single();
  if (goalError || !goal) throw new Error("Goal not found");

  const { data: week, error: weekError } = await db
    .from("plan_weeks")
    .select("id")
    .eq("id", parsed.planWeekId)
    .eq("goal_id", parsed.goalId)
    .single();
  if (weekError || !week) throw new Error("Plan week not found");

  const { data: taskRows } = await db
    .from("tasks")
    .select("effort_minutes, status")
    .eq("plan_week_id", parsed.planWeekId);
  const tasks = taskRows ?? [];
  const done = tasks.filter((t) => t.status === "done");

  const synthesis = await runReflect(
    {
      outcomeStatement: goal.outcome_statement,
      domain: goal.domain ?? "other",
      weekExecution: {
        plannedMinutes: tasks.reduce((s, t) => s + t.effort_minutes, 0),
        completedMinutes: done.reduce((s, t) => s + t.effort_minutes, 0),
        tasksDone: done.length,
        tasksTotal: tasks.length,
      },
      userReflection: {
        whatWorked: parsed.whatWorked ?? null,
        whatDidnt: parsed.whatDidnt ?? null,
        blockers: parsed.blockers ?? null,
      },
    },
    { userId: user.id, goalId: parsed.goalId, traceId: randomUUID(), db },
  );

  const { error } = await db.from("reflections").upsert(
    {
      goal_id: parsed.goalId,
      user_id: user.id,
      plan_week_id: parsed.planWeekId,
      what_worked: parsed.whatWorked ?? null,
      what_didnt: parsed.whatDidnt ?? null,
      blockers: parsed.blockers ?? null,
      ai_synthesis: synthesis as unknown as Json,
    },
    { onConflict: "goal_id,plan_week_id" },
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/goals/${parsed.goalId}/reflect`);
  return { synthesis };
}
