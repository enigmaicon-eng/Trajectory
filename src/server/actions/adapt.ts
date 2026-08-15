"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { computeAndPersistGoalSignals } from "@/server/actions/signals";
import { proposeReplan, applyPlanPatch } from "@/server/actions/replan";
import type { PlanOp } from "@/lib/ai/modules/replan/output.schema";

async function requireUser() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { db, user };
}

const requestReplanSchema = z.object({ goalId: z.string().uuid(), reason: z.string().max(500).optional() });

/** §8.1 requestReplan: user-initiated `user_requested` trigger. */
export async function requestReplan(input: z.infer<typeof requestReplanSchema>) {
  const { goalId, reason } = requestReplanSchema.parse(input);
  const { db, user } = await requireUser();

  const summary = await computeAndPersistGoalSignals(db, goalId);
  const result = await proposeReplan(
    db,
    goalId,
    user.id,
    "user_requested",
    reason ?? "The user asked for a replan.",
    summary,
  );
  if (!result) throw new Error("A replan proposal is already pending for this goal.");

  revalidatePath(`/goals/${goalId}/history`);
  return result;
}

const respondToReplanSchema = z.object({
  replanEventId: z.string().uuid(),
  accept: z.boolean(),
});

/**
 * §8.1 respondToReplan / AC-8.30: accepting creates plan version N+1 and
 * supersedes the prior version (via `applyPlanPatch` -> `generatePlan`);
 * rejecting just records the rejection and leaves the active plan untouched.
 */
export async function respondToReplan(input: z.infer<typeof respondToReplanSchema>) {
  const { replanEventId, accept } = respondToReplanSchema.parse(input);
  const { db, user } = await requireUser();

  const { data: event, error: eventError } = await db
    .from("replan_events")
    .select("id, goal_id, patch, accepted")
    .eq("id", replanEventId)
    .single();
  if (eventError || !event) throw new Error("Replan proposal not found");
  if (event.accepted !== null) throw new Error("This proposal has already been responded to.");

  if (!accept) {
    const { error } = await db
      .from("replan_events")
      .update({ accepted: false, responded_at: new Date().toISOString() })
      .eq("id", replanEventId);
    if (error) throw new Error(error.message);
    revalidatePath(`/goals/${event.goal_id}/history`);
    return { accepted: false };
  }

  const patch = event.patch as { ops: PlanOp[] };
  const { planId } = await applyPlanPatch(db, event.goal_id, user.id, patch.ops);

  const { error } = await db
    .from("replan_events")
    .update({ accepted: true, responded_at: new Date().toISOString(), to_plan_id: planId })
    .eq("id", replanEventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/goals/${event.goal_id}/history`);
  revalidatePath(`/goals/${event.goal_id}/today`);
  revalidatePath(`/goals/${event.goal_id}/week`);
  revalidatePath(`/goals/${event.goal_id}/map`);

  return { accepted: true, planId };
}
