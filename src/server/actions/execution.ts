"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { todayISO } from "@/lib/domain/dates";

async function requireUser() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { db, user };
}

// ── tasks ────────────────────────────────────────────────────────────────

const evidenceInputSchema = z.object({
  kind: z.enum(["link", "text", "file", "self_attest"]),
  url: z.string().url().optional(),
  body: z.string().min(1).optional(),
  storagePath: z.string().min(1).optional(),
});

const completeTaskSchema = z.object({
  taskId: z.string().uuid(),
  evidence: evidenceInputSchema.optional(),
});

export async function completeTask(input: z.infer<typeof completeTaskSchema>) {
  const { taskId, evidence } = completeTaskSchema.parse(input);
  const { db, user } = await requireUser();

  const { data: task, error: taskError } = await db
    .from("tasks")
    .select("id, goal_id")
    .eq("id", taskId)
    .single();
  if (taskError || !task) throw new Error("Task not found");

  const { error: updateError } = await db
    .from("tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", taskId);
  if (updateError) throw new Error(updateError.message);

  if (evidence) {
    const { error: evidenceError } = await db.from("evidence").insert({
      goal_id: task.goal_id,
      user_id: user.id,
      task_id: taskId,
      kind: evidence.kind,
      url: evidence.url ?? null,
      body: evidence.body ?? null,
      storage_path: evidence.storagePath ?? null,
    });
    if (evidenceError) throw new Error(evidenceError.message);
  }

  revalidatePath(`/goals/${task.goal_id}/today`);
  revalidatePath(`/goals/${task.goal_id}/week`);
}

const undoTaskCompletionSchema = z.object({ taskId: z.string().uuid() });

/** §9.6: completion is reversible on the row itself, with no time limit. */
export async function undoTaskCompletion(input: z.infer<typeof undoTaskCompletionSchema>) {
  const { taskId } = undoTaskCompletionSchema.parse(input);
  const { db } = await requireUser();

  const { data: task, error: taskError } = await db
    .from("tasks")
    .select("id, goal_id, status")
    .eq("id", taskId)
    .single();
  if (taskError || !task) throw new Error("Task not found");
  if (task.status !== "done") throw new Error("This task isn't marked done.");

  const { error } = await db.from("tasks").update({ status: "pending", completed_at: null }).eq("id", taskId);
  if (error) throw new Error(error.message);

  revalidatePath(`/goals/${task.goal_id}/today`);
  revalidatePath(`/goals/${task.goal_id}/week`);
}

const skipTaskSchema = z.object({ taskId: z.string().uuid(), reason: z.string().max(300).optional() });

export async function skipTask(input: z.infer<typeof skipTaskSchema>) {
  const { taskId } = skipTaskSchema.parse(input);
  const { db } = await requireUser();

  const { data: task, error: taskError } = await db
    .from("tasks")
    .select("id, goal_id")
    .eq("id", taskId)
    .single();
  if (taskError || !task) throw new Error("Task not found");

  const { error } = await db.from("tasks").update({ status: "skipped" }).eq("id", taskId);
  if (error) throw new Error(error.message);

  revalidatePath(`/goals/${task.goal_id}/today`);
  revalidatePath(`/goals/${task.goal_id}/week`);
}

const deferTaskSchema = z.object({ taskId: z.string().uuid(), toDate: z.string().date() });

/**
 * Marks the original task `deferred` (so signals can distinguish it from a
 * genuine skip) and clones it onto `toDate` as a fresh, actionable `pending`
 * task — rather than silently mutating scheduled_for, which would erase the
 * fact that it slipped.
 */
export async function deferTask(input: z.infer<typeof deferTaskSchema>) {
  const { taskId, toDate } = deferTaskSchema.parse(input);
  const { db, user } = await requireUser();

  const { data: task, error: taskError } = await db.from("tasks").select("*").eq("id", taskId).single();
  if (taskError || !task) throw new Error("Task not found");

  const { error: updateError } = await db.from("tasks").update({ status: "deferred" }).eq("id", taskId);
  if (updateError) throw new Error(updateError.message);

  const { error: insertError } = await db.from("tasks").insert({
    id: randomUUID(),
    plan_week_id: task.plan_week_id,
    weekly_outcome_id: task.weekly_outcome_id,
    project_node_id: task.project_node_id,
    goal_id: task.goal_id,
    user_id: user.id,
    title: task.title,
    why: task.why,
    effort_minutes: task.effort_minutes,
    tier: task.tier,
    scheduled_for: toDate,
    sequence: task.sequence,
    status: "pending",
    is_user_added: false,
  });
  if (insertError) throw new Error(insertError.message);

  revalidatePath(`/goals/${task.goal_id}/today`);
  revalidatePath(`/goals/${task.goal_id}/week`);
}

const addTaskSchema = z.object({
  planWeekId: z.string().uuid(),
  title: z.string().min(1).max(160),
  effortMinutes: z.number().int().min(5).max(480),
  tier: z.enum(["minimum", "normal", "ideal"]).default("normal"),
  weeklyOutcomeId: z.string().uuid().optional(),
  scheduledFor: z.string().date().optional(),
});

export async function addTask(input: z.infer<typeof addTaskSchema>) {
  const parsed = addTaskSchema.parse(input);
  const { db, user } = await requireUser();

  const { data: week, error: weekError } = await db
    .from("plan_weeks")
    .select("id, goal_id")
    .eq("id", parsed.planWeekId)
    .single();
  if (weekError || !week) throw new Error("Plan week not found");

  const { data: maxSeqRow } = await db
    .from("tasks")
    .select("sequence")
    .eq("plan_week_id", parsed.planWeekId)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await db.from("tasks").insert({
    id: randomUUID(),
    plan_week_id: parsed.planWeekId,
    weekly_outcome_id: parsed.weeklyOutcomeId ?? null,
    goal_id: week.goal_id,
    user_id: user.id,
    title: parsed.title,
    effort_minutes: parsed.effortMinutes,
    tier: parsed.tier,
    scheduled_for: parsed.scheduledFor ?? todayISO(),
    sequence: (maxSeqRow?.sequence ?? -1) + 1,
    status: "pending",
    is_user_added: true,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/goals/${week.goal_id}/today`);
  revalidatePath(`/goals/${week.goal_id}/week`);
}

const reorderTasksSchema = z.object({ planWeekId: z.string().uuid(), orderedIds: z.array(z.string().uuid()).min(1) });

export async function reorderTasks(input: z.infer<typeof reorderTasksSchema>) {
  const { planWeekId, orderedIds } = reorderTasksSchema.parse(input);
  const { db } = await requireUser();

  const { data: week, error: weekError } = await db
    .from("plan_weeks")
    .select("id, goal_id")
    .eq("id", planWeekId)
    .single();
  if (weekError || !week) throw new Error("Plan week not found");

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await db
      .from("tasks")
      .update({ sequence: i })
      .eq("id", orderedIds[i])
      .eq("plan_week_id", planWeekId);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/goals/${week.goal_id}/week`);
}

// ── check-ins & evidence ─────────────────────────────────────────────────

const submitCheckInSchema = z.object({
  goalId: z.string().uuid(),
  kind: z.enum(["daily", "weekly"]),
  occurredOn: z.string().date(),
  minutesAvailable: z.number().int().min(0).optional(),
  minutesSpent: z.number().int().min(0).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  note: z.string().max(500).optional(),
});

/**
 * §10.1: two check-ins a day (forward: minutes available + energy; evening:
 * energy + note) share one `checkins` row per (goal, kind, day) — the unique
 * constraint doesn't distinguish them. A plain upsert of only the fields one
 * variant asks for would null out whatever the other variant already saved
 * that same day, so this reads the existing row first and merges.
 */
export async function submitCheckIn(input: z.infer<typeof submitCheckInSchema>) {
  const parsed = submitCheckInSchema.parse(input);
  const { db, user } = await requireUser();

  const { data: existing } = await db
    .from("checkins")
    .select("minutes_available, minutes_spent, energy, note")
    .eq("goal_id", parsed.goalId)
    .eq("kind", parsed.kind)
    .eq("occurred_on", parsed.occurredOn)
    .maybeSingle();

  const { error } = await db
    .from("checkins")
    .upsert(
      {
        goal_id: parsed.goalId,
        user_id: user.id,
        kind: parsed.kind,
        occurred_on: parsed.occurredOn,
        minutes_available: parsed.minutesAvailable ?? existing?.minutes_available ?? null,
        minutes_spent: parsed.minutesSpent ?? existing?.minutes_spent ?? null,
        energy: parsed.energy ?? existing?.energy ?? null,
        note: parsed.note ?? existing?.note ?? null,
      },
      { onConflict: "goal_id,kind,occurred_on" },
    );
  if (error) throw new Error(error.message);

  revalidatePath(`/goals/${parsed.goalId}/today`);
}

const attachEvidenceSchema = z.object({
  goalId: z.string().uuid(),
  subject: z.union([
    z.object({ taskId: z.string().uuid() }),
    z.object({ weeklyOutcomeId: z.string().uuid() }),
    z.object({ nodeId: z.string().uuid() }),
  ]),
  kind: z.enum(["link", "text", "file", "self_attest"]),
  url: z.string().url().optional(),
  body: z.string().min(1).optional(),
  storagePath: z.string().min(1).optional(),
});

export async function attachEvidence(input: z.infer<typeof attachEvidenceSchema>) {
  const parsed = attachEvidenceSchema.parse(input);
  const { db, user } = await requireUser();

  const { error } = await db.from("evidence").insert({
    goal_id: parsed.goalId,
    user_id: user.id,
    task_id: "taskId" in parsed.subject ? parsed.subject.taskId : null,
    weekly_outcome_id: "weeklyOutcomeId" in parsed.subject ? parsed.subject.weeklyOutcomeId : null,
    node_id: "nodeId" in parsed.subject ? parsed.subject.nodeId : null,
    kind: parsed.kind,
    url: parsed.url ?? null,
    body: parsed.body ?? null,
    storage_path: parsed.storagePath ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/goals/${parsed.goalId}/map`);
}

// ── graph node status ────────────────────────────────────────────────────

const setNodeStatusSchema = z.object({
  nodeId: z.string().uuid(),
  status: z.enum(["not_started", "in_progress", "blocked", "complete", "dropped"]),
});

/** AC-5.18: a milestone cannot be marked complete without non-self_attest evidence. */
export async function setNodeStatus(input: z.infer<typeof setNodeStatusSchema>) {
  const parsed = setNodeStatusSchema.parse(input);
  const { db } = await requireUser();

  const { data: node, error: nodeError } = await db
    .from("goal_nodes")
    .select("id, goal_id, kind")
    .eq("id", parsed.nodeId)
    .single();
  if (nodeError || !node) throw new Error("Node not found");

  if (parsed.status === "complete" && node.kind === "milestone") {
    const { data: evidenceRows, error: evidenceError } = await db
      .from("evidence")
      .select("id")
      .eq("node_id", parsed.nodeId)
      .neq("kind", "self_attest")
      .limit(1);
    if (evidenceError) throw new Error(evidenceError.message);
    if (!evidenceRows || evidenceRows.length === 0) {
      throw new Error("A milestone needs non-self-attested evidence before it can be marked complete.");
    }
  }

  const { error } = await db
    .from("goal_nodes")
    .update({ status: parsed.status, completed_at: parsed.status === "complete" ? new Date().toISOString() : null })
    .eq("id", parsed.nodeId);
  if (error) throw new Error(error.message);

  revalidatePath(`/goals/${node.goal_id}/map`);
}
