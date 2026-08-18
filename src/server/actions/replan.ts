import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/types.generated";
import { runReplan } from "@/lib/ai/modules/replan";
import type { ReplanInput } from "@/lib/ai/modules/replan/input.schema";
import type { PlanOp, ReplanOutput } from "@/lib/ai/modules/replan/output.schema";
import { computeAndPersistGoalSignals, type GoalSignalsSummary } from "@/server/actions/signals";
import { generatePlan } from "@/server/actions/plan";
import { evaluateReplanTriggers, type DetectedTrigger, type ReplanTriggerKind } from "@/lib/domain/replan";
import { daysBetween, todayISO } from "@/lib/domain/dates";
import { snapshotGraphRevision } from "@/server/actions/graph-revisions";

type DB = SupabaseClient<Database>;
type ReplanTrigger = ReplanInput["trigger"];

const TRIGGER_LABEL: Record<ReplanTriggerKind, string> = {
  low_execution: "Execution has stayed below half of planned effort for two consecutive weeks.",
  ahead_of_schedule: "Execution has exceeded 140% of planned effort for two consecutive weeks.",
  milestone_off_track: "A milestone on the critical path is off track.",
  capacity_changed: "Available weekly capacity changed by more than 25%.",
  missed_checkins: "No completed task or check-in in 10 or more consecutive days.",
};

const REPLAN_COOLDOWN_DAYS = 7; // AC-8.31: a rejected adaptation isn't re-proposed for the same trigger within 7 days.

async function hasPendingProposal(db: DB, goalId: string, trigger: ReplanTrigger): Promise<boolean> {
  const { data } = await db
    .from("replan_events")
    .select("id")
    .eq("goal_id", goalId)
    .eq("trigger", trigger)
    .is("accepted", null)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

function addDaysISO(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function recentlyRejected(db: DB, goalId: string, trigger: ReplanTrigger): Promise<boolean> {
  const cutoff = `${addDaysISO(todayISO(), -REPLAN_COOLDOWN_DAYS)}T00:00:00Z`;
  const { data } = await db
    .from("replan_events")
    .select("id")
    .eq("goal_id", goalId)
    .eq("trigger", trigger)
    .eq("accepted", false)
    .gte("responded_at", cutoff)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function buildReplanInput(
  db: DB,
  goalId: string,
  trigger: ReplanTrigger,
  triggerDetailText: string,
  summary: GoalSignalsSummary,
): Promise<ReplanInput> {
  const { data: goal, error: goalError } = await db
    .from("goals")
    .select("outcome_statement, domain")
    .eq("id", goalId)
    .single();
  if (goalError || !goal) throw new Error(goalError?.message ?? "Goal not found");

  const { data: capacityRow, error: capacityError } = await db
    .from("capacity_profiles")
    .select("ideal_minutes, normal_minutes, minimum_minutes, days_per_week")
    .eq("goal_id", goalId)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (capacityError) throw new Error(capacityError.message);
  if (!capacityRow) throw new Error("No capacity profile on record");

  const { data: milestoneRows, error: milestoneError } = await db
    .from("goal_nodes")
    .select("id, title, target_date")
    .eq("goal_id", goalId)
    .eq("kind", "milestone");
  if (milestoneError) throw new Error(milestoneError.message);

  const riskById = new Map(summary.milestoneRisks.map((m) => [m.nodeId, m]));
  const milestones = (milestoneRows ?? []).map((m) => {
    const risk = riskById.get(m.id);
    return {
      id: m.id,
      title: m.title,
      targetDate: m.target_date,
      risk: risk?.risk ?? "unknown",
      onCriticalPath: risk?.onCriticalPath ?? false,
    };
  });
  if (milestones.length === 0) throw new Error("Goal has no milestones to replan against");

  const { data: signalsRow } = await db
    .from("goal_signals")
    .select("momentum, execution_rate, plan_confidence, risk_level")
    .eq("goal_id", goalId)
    .eq("captured_on", summary.capturedOn)
    .maybeSingle();

  return {
    outcomeStatement: goal.outcome_statement,
    domain: goal.domain ?? "other",
    trigger,
    triggerDetail: triggerDetailText.slice(0, 500),
    milestones: milestones.slice(0, 10),
    capacity: {
      idealMinutes: capacityRow.ideal_minutes,
      normalMinutes: capacityRow.normal_minutes,
      minimumMinutes: capacityRow.minimum_minutes,
      daysPerWeek: capacityRow.days_per_week,
    },
    signals: {
      momentum: signalsRow?.momentum ?? null,
      executionRate: signalsRow?.execution_rate ?? null,
      planConfidence: signalsRow?.plan_confidence ?? 0.5,
      riskLevel: signalsRow?.risk_level ?? "unknown",
    },
  };
}

export interface ProposeReplanResult {
  replanEventId: string;
}

/**
 * Diagnoses a trigger and persists a pending `replan_events` row (patch +
 * diagnosis, `accepted = null`) for the user to review at `/history`. Shared
 * by cron (signal-driven triggers) and `requestReplan` (user-initiated).
 *
 * Deviates from §8.3's "no AI runs in cron" in one respect: `replan_events`
 * requires `diagnosis`/`patch` non-null at insert (§4.2), so there's no
 * schema-backed place to park a trigger before diagnosing it — the
 * alternative (a second table just to defer this) isn't worth it for a call
 * that only fires when a trigger genuinely trips, not on every cron tick.
 */
export async function proposeReplan(
  db: DB,
  goalId: string,
  userId: string,
  trigger: ReplanTrigger,
  triggerDetail: Record<string, unknown> | string,
  summary: GoalSignalsSummary,
): Promise<ProposeReplanResult | null> {
  if (await hasPendingProposal(db, goalId, trigger)) return null;
  if (await recentlyRejected(db, goalId, trigger)) return null;

  const detailText =
    typeof triggerDetail === "string" ? triggerDetail : (TRIGGER_LABEL[trigger as ReplanTriggerKind] ?? trigger);
  const input = await buildReplanInput(db, goalId, trigger, detailText, summary);
  const output = await runReplan(input, { userId, goalId, traceId: randomUUID(), db });

  const { data: activePlan } = await db
    .from("plans")
    .select("id")
    .eq("goal_id", goalId)
    .eq("status", "active")
    .maybeSingle();

  const { data: row, error } = await db
    .from("replan_events")
    .insert({
      goal_id: goalId,
      user_id: userId,
      trigger,
      trigger_detail: (typeof triggerDetail === "string" ? { note: triggerDetail } : triggerDetail) as Json,
      diagnosis: output.diagnosis,
      patch: output as unknown as Json,
      from_plan_id: activePlan?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !row) throw new Error(error?.message ?? "Failed to persist replan proposal");

  return { replanEventId: row.id as string };
}

async function alreadyHandledCapacityChange(db: DB, goalId: string, capacityProfileId: string): Promise<boolean> {
  const { data } = await db
    .from("replan_events")
    .select("trigger_detail")
    .eq("goal_id", goalId)
    .eq("trigger", "capacity_changed")
    .limit(20);
  return (data ?? []).some(
    (r) => (r.trigger_detail as { capacityProfileId?: string } | null)?.capacityProfileId === capacityProfileId,
  );
}

/**
 * Computes today's signals, evaluates every signal-driven trigger (§5.6),
 * and proposes a replan for each newly detected one. Called once per active
 * goal by `/api/cron/daily`.
 */
export async function evaluateAndProposeReplans(db: DB, goalId: string, userId: string): Promise<DetectedTrigger[]> {
  const summary = await computeAndPersistGoalSignals(db, goalId);

  const { data: recentCapacity } = await db
    .from("capacity_profiles")
    .select("id, ideal_minutes, days_per_week")
    .eq("goal_id", goalId)
    .order("effective_from", { ascending: false })
    .limit(2);

  let capacityChange: { previousWeeklyMinutes: number; newWeeklyMinutes: number } | null = null;
  let capacityProfileId: string | null = null;
  if (recentCapacity && recentCapacity.length === 2) {
    const [current, previous] = recentCapacity;
    capacityProfileId = current.id as string;
    capacityChange = {
      previousWeeklyMinutes: previous.ideal_minutes * previous.days_per_week,
      newWeeklyMinutes: current.ideal_minutes * current.days_per_week,
    };
  }
  if (capacityProfileId && (await alreadyHandledCapacityChange(db, goalId, capacityProfileId))) {
    capacityChange = null; // already proposed (accepted, rejected, or pending) for this specific change
  }

  const triggers = evaluateReplanTriggers({
    trailingWeeklyExecutionRates: summary.trailingWeeklyExecutionRates,
    milestoneRisks: summary.milestoneRisks,
    capacityChange,
    daysSinceLastActivity: summary.daysSinceLastActivity,
  });

  for (const t of triggers) {
    const detail = t.kind === "capacity_changed" ? { ...t.detail, capacityProfileId } : t.detail;
    await proposeReplan(db, goalId, userId, t.kind, detail, summary);
  }

  return triggers;
}

export interface ApplyPlanPatchResult {
  planId: string;
}

/**
 * Applies an accepted `PlanPatch`'s ops to the graph/capacity/goal, then
 * regenerates the plan (§5.6: `rebuild_weeks` is deliberately unsupported —
 * every accepted patch regenerates the plan regardless, via `generatePlan`,
 * which supersedes the current active plan and creates version N+1).
 */
export async function applyPlanPatch(
  db: DB,
  goalId: string,
  userId: string,
  ops: PlanOp[],
  replanEventId?: string,
): Promise<ApplyPlanPatchResult> {
  for (const op of ops) {
    switch (op.op) {
      case "shift_milestone": {
        if (!op.nodeId || !op.newTargetDate) break;
        const { error } = await db
          .from("goal_nodes")
          .update({ target_date: op.newTargetDate })
          .eq("id", op.nodeId)
          .eq("goal_id", goalId);
        if (error) throw new Error(error.message);
        break;
      }
      case "rescope_milestone": {
        if (!op.nodeId || (!op.newTitle && !op.newVerification)) break;
        const { error } = await db
          .from("goal_nodes")
          .update({
            ...(op.newTitle ? { title: op.newTitle } : {}),
            ...(op.newVerification ? { verification: op.newVerification } : {}),
          })
          .eq("id", op.nodeId)
          .eq("goal_id", goalId);
        if (error) throw new Error(error.message);
        break;
      }
      case "drop_project": {
        if (!op.nodeId) break;
        const { error } = await db
          .from("goal_nodes")
          .update({ status: "dropped", dropped_at: new Date().toISOString(), dropped_reason: op.reason })
          .eq("id", op.nodeId)
          .eq("goal_id", goalId);
        if (error) throw new Error(error.message);
        break;
      }
      case "add_dependency": {
        if (!op.fromNodeId || !op.toNodeId) break;
        const { error } = await db.from("node_dependencies").insert({
          goal_id: goalId,
          user_id: userId,
          from_node_id: op.fromNodeId,
          to_node_id: op.toNodeId,
          type: "blocks",
          rationale: op.reason,
        });
        if (error) throw new Error(error.message);
        break;
      }
      case "remove_dependency": {
        if (!op.fromNodeId || !op.toNodeId) break;
        // Soft-delete (§4.2 v2): the graph is append-only, so an edge is
        // marked removed rather than deleted. This also frees its
        // (from, to, type) slot — via the partial unique index that only
        // covers live rows — for a later add_dependency to re-add the same
        // edge without a constraint conflict.
        const { error } = await db
          .from("node_dependencies")
          .update({ removed_at: new Date().toISOString(), removed_reason: op.reason ?? null })
          .eq("goal_id", goalId)
          .eq("from_node_id", op.fromNodeId)
          .eq("to_node_id", op.toNodeId)
          .is("removed_at", null);
        if (error) throw new Error(error.message);
        break;
      }
      case "adjust_capacity": {
        if (op.idealMinutes == null || op.normalMinutes == null || op.minimumMinutes == null || op.daysPerWeek == null) {
          break;
        }
        const { data: latest } = await db
          .from("capacity_profiles")
          .select("preferred_days, blackout_dates")
          .eq("goal_id", goalId)
          .order("effective_from", { ascending: false })
          .limit(1)
          .maybeSingle();
        const { error } = await db.from("capacity_profiles").insert({
          goal_id: goalId,
          user_id: userId,
          effective_from: todayISO(),
          ideal_minutes: op.idealMinutes,
          normal_minutes: op.normalMinutes,
          minimum_minutes: op.minimumMinutes,
          days_per_week: op.daysPerWeek,
          preferred_days: latest?.preferred_days ?? [1, 2, 3, 4, 5],
          blackout_dates: latest?.blackout_dates ?? [],
          note: op.reason,
        });
        if (error) throw new Error(error.message);
        break;
      }
      case "extend_horizon": {
        if (!op.newTargetDate) break;
        const { data: goal } = await db.from("goals").select("started_on").eq("id", goalId).single();
        const start = goal?.started_on ?? todayISO();
        const weeks = Math.max(1, Math.ceil(daysBetween(start, op.newTargetDate) / 7));
        const { error } = await db
          .from("goals")
          .update({ target_date: op.newTargetDate, horizon_weeks: weeks })
          .eq("id", goalId);
        if (error) throw new Error(error.message);
        break;
      }
      case "narrow_outcome": {
        if (!op.newOutcomeStatement) break;
        const { error } = await db
          .from("goals")
          .update({ outcome_statement: op.newOutcomeStatement })
          .eq("id", goalId);
        if (error) throw new Error(error.message);
        break;
      }
    }
  }

  await snapshotGraphRevision(db, goalId, userId, "replan", replanEventId);

  const result = await generatePlan(db, goalId, userId);
  return { planId: result.planId };
}

export type { ReplanOutput };
