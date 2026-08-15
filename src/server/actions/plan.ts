import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types.generated";
import { runPlanWeek } from "@/lib/ai/modules/plan_week";
import type { PlanWeekInput } from "@/lib/ai/modules/plan_week/input.schema";
import { readyNodes } from "@/lib/domain/graph";
import type { GraphEdge, GraphNode } from "@/lib/domain/types";
import { horizonEnd, todayISO, weekBoundaries, weekBoundary, type WeekBoundary } from "@/lib/domain/dates";
import { availableDaysInWeek, weekCapacityMinutes, type CapacityProfileLike } from "@/lib/domain/capacity";
import { scheduleTasks, type CandidateTaskLike } from "@/lib/domain/scheduler";

type DB = SupabaseClient<Database>;

export interface GeneratePlanResult {
  planId: string;
  weekCount: number;
  week1OutcomeCount: number;
  week1TaskCount: number;
}

interface EligibleProject {
  id: string;
  title: string;
  verification: string;
  estimatedMinutes: number;
}

async function loadCapacityProfile(db: DB, goalId: string): Promise<CapacityProfileLike> {
  const { data: capacityRow, error } = await db
    .from("capacity_profiles")
    .select("ideal_minutes, normal_minutes, minimum_minutes, days_per_week, preferred_days, blackout_dates")
    .eq("goal_id", goalId)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!capacityRow) throw new Error("No capacity profile on record — decompose must run first");

  return {
    idealMinutes: capacityRow.ideal_minutes,
    normalMinutes: capacityRow.normal_minutes,
    minimumMinutes: capacityRow.minimum_minutes,
    daysPerWeek: capacityRow.days_per_week,
    preferredDays: capacityRow.preferred_days,
    blackoutDates: capacityRow.blackout_dates,
  };
}

async function loadEligibleProjects(db: DB, goalId: string): Promise<EligibleProject[]> {
  const { data: nodeRows, error: nodesError } = await db
    .from("goal_nodes")
    .select("id, kind, parent_id, title, verification, estimated_minutes, status")
    .eq("goal_id", goalId);
  if (nodesError) throw new Error(nodesError.message);
  const { data: edgeRows, error: edgesError } = await db
    .from("node_dependencies")
    .select("from_node_id, to_node_id, type")
    .eq("goal_id", goalId);
  if (edgesError) throw new Error(edgesError.message);

  const nodes = nodeRows ?? [];
  const edges = edgeRows ?? [];
  if (nodes.length === 0) throw new Error("Goal has no graph — decompose must run first");

  const graphNodes: GraphNode[] = nodes.map((n) => ({
    id: n.id,
    kind: n.kind,
    parentId: n.parent_id,
    estimatedMinutes: n.estimated_minutes,
  }));
  const graphEdges: GraphEdge[] = edges.map((e) => ({
    fromNodeId: e.from_node_id,
    toNodeId: e.to_node_id,
    type: e.type,
  }));
  const completedIds = new Set(nodes.filter((n) => n.status === "complete").map((n) => n.id));
  const readyIds = new Set(readyNodes(graphNodes, graphEdges, completedIds));

  return nodes
    .filter((n) => n.kind === "project" && readyIds.has(n.id) && n.status !== "complete" && n.status !== "dropped")
    .map((p) => ({ id: p.id, title: p.title, verification: p.verification, estimatedMinutes: p.estimated_minutes ?? 0 }));
}

interface PersistWeekPlanResult {
  outcomeCount: number;
  taskCount: number;
}

/**
 * Runs `plan_week` for one already-created `plan_weeks` row and persists its
 * weekly outcomes + scheduled tasks. Shared by `generatePlan` (week 0, at
 * plan-creation time) and `advanceCurrentWeek` (a later week, generated
 * lazily by cron as it arrives — §8.3).
 */
async function persistWeekPlan(
  db: DB,
  goalId: string,
  userId: string,
  weekId: string,
  week: WeekBoundary,
  weeksRemaining: number,
  outcomeStatement: string,
  domain: string | null,
  eligibleProjects: EligibleProject[],
  capacity: CapacityProfileLike,
  recentExecution: PlanWeekInput["recentExecution"],
): Promise<PersistWeekPlanResult> {
  const availableDays = availableDaysInWeek(capacity, week);

  const planWeekInput: PlanWeekInput = {
    outcomeStatement,
    domain: domain ?? "other",
    weekIndex: week.weekIndex,
    weeksRemaining,
    eligibleProjects,
    capacity: {
      idealMinutes: capacity.idealMinutes,
      normalMinutes: capacity.normalMinutes,
      minimumMinutes: capacity.minimumMinutes,
      availableDayCount: Math.max(1, availableDays.length),
    },
    recentExecution,
  };

  const planWeekOutput = await runPlanWeek(planWeekInput, { userId, goalId, traceId: randomUUID(), db });

  const outcomeIdByTemp = new Map<string, string>();
  const outcomeRows = planWeekOutput.weeklyOutcomes.map((o) => {
    const id = randomUUID();
    outcomeIdByTemp.set(o.tempId, id);
    return {
      id,
      plan_week_id: weekId,
      goal_id: goalId,
      user_id: userId,
      project_node_id: o.projectNodeId,
      statement: o.statement,
      success_criteria: o.successCriteria,
      priority: o.priority,
    };
  });
  const { error: outcomesError } = await db.from("weekly_outcomes").insert(outcomeRows);
  if (outcomesError) throw new Error(`Failed to persist weekly outcomes: ${outcomesError.message}`);

  const candidateTasks: CandidateTaskLike[] = planWeekOutput.candidateTasks
    .filter((t) => outcomeIdByTemp.has(t.outcomeTempId))
    .map((t) => {
      const outcomeRow = outcomeRows.find((o) => o.id === outcomeIdByTemp.get(t.outcomeTempId));
      return {
        tempId: t.tempId,
        title: t.title,
        why: t.why,
        effortMinutes: t.effortMinutes,
        tier: t.tier,
        outcomeTempId: t.outcomeTempId,
        projectNodeId: outcomeRow?.project_node_id ?? null,
      };
    });

  const { scheduled } = scheduleTasks(candidateTasks, availableDays, capacity.idealMinutes);

  const taskRows = scheduled.map((t) => ({
    id: randomUUID(),
    plan_week_id: weekId,
    weekly_outcome_id: outcomeIdByTemp.get(t.outcomeTempId) ?? null,
    project_node_id: t.projectNodeId,
    goal_id: goalId,
    user_id: userId,
    title: t.title,
    why: t.why,
    effort_minutes: t.effortMinutes,
    tier: t.tier,
    scheduled_for: t.scheduledFor,
    sequence: t.sequence,
  }));
  if (taskRows.length > 0) {
    const { error: tasksError } = await db.from("tasks").insert(taskRows);
    if (tasksError) throw new Error(`Failed to persist tasks: ${tasksError.message}`);
  }

  return { outcomeCount: outcomeRows.length, taskCount: taskRows.length };
}

/**
 * Creates the active plan for a goal: `plan_weeks` metadata rows (dates +
 * capacity budget) span the *entire* horizon deterministically, but only
 * week 0 gets AI-generated `weekly_outcomes`/`tasks` — matching AC-4.14's
 * <90s latency target (one `plan_week` call, not one per week of a
 * potentially 260-week horizon) and §8.3's cron, which rolls the plan
 * forward and generates each subsequent week lazily as it arrives (see
 * `advanceCurrentWeek`). Also usable for a replan: an existing active plan is
 * superseded first, matching plans' one-active-plan-per-goal constraint.
 */
export async function generatePlan(db: DB, goalId: string, userId: string): Promise<GeneratePlanResult> {
  const { data: goal, error: goalError } = await db
    .from("goals")
    .select("outcome_statement, domain, horizon_weeks, started_on")
    .eq("id", goalId)
    .single();
  if (goalError || !goal) throw new Error(goalError?.message ?? "Goal not found");

  const horizonWeeks = goal.horizon_weeks ?? 12;
  const horizonStart = goal.started_on ?? todayISO();

  const capacity = await loadCapacityProfile(db, goalId);
  const eligibleProjects = await loadEligibleProjects(db, goalId);
  // Unreachable in practice: breakCycles() already guarantees the persisted
  // graph is a DAG, and any nonempty DAG has at least one zero-indegree
  // (i.e. ready) node. Kept as a defensive guard, not a real user-facing path.
  if (eligibleProjects.length === 0) {
    throw new Error("generatePlan: no ready projects to plan against");
  }

  const { data: existingActive } = await db
    .from("plans")
    .select("id, version")
    .eq("goal_id", goalId)
    .eq("status", "active")
    .maybeSingle();

  if (existingActive) {
    const { error: supersedeError } = await db
      .from("plans")
      .update({ status: "superseded" })
      .eq("id", existingActive.id);
    if (supersedeError) throw new Error(`Failed to supersede prior plan: ${supersedeError.message}`);
  }

  const nextVersion = (existingActive?.version ?? 0) + 1;
  const horizonEndDate = horizonEnd(horizonStart, horizonWeeks);

  const { data: planRow, error: planError } = await db
    .from("plans")
    .insert({
      goal_id: goalId,
      user_id: userId,
      version: nextVersion,
      status: "generating",
      source: existingActive ? "replan" : "initial",
      supersedes_id: existingActive?.id ?? null,
      horizon_start: horizonStart,
      horizon_end: horizonEndDate,
    })
    .select("id")
    .single();
  if (planError || !planRow) throw new Error(planError?.message ?? "Failed to create plan");
  const planId = planRow.id as string;

  const weeks = weekBoundaries(horizonStart, horizonWeeks);
  const weekIds = weeks.map(() => randomUUID());
  const weekRows = weeks.map((w, i) => ({
    id: weekIds[i],
    plan_id: planId,
    goal_id: goalId,
    user_id: userId,
    week_index: w.weekIndex,
    starts_on: w.startsOn,
    ends_on: w.endsOn,
    capacity_minutes: weekCapacityMinutes(capacity, w),
  }));
  const { error: weeksError } = await db.from("plan_weeks").insert(weekRows);
  if (weeksError) throw new Error(`Failed to persist plan weeks: ${weeksError.message}`);

  const { outcomeCount, taskCount } = await persistWeekPlan(
    db,
    goalId,
    userId,
    weekIds[0],
    weeks[0],
    horizonWeeks,
    goal.outcome_statement,
    goal.domain,
    eligibleProjects,
    capacity,
    null,
  );

  const { error: activateError } = await db
    .from("plans")
    .update({ status: "active", activated_at: new Date().toISOString() })
    .eq("id", planId);
  if (activateError) throw new Error(`Failed to activate plan: ${activateError.message}`);

  return {
    planId,
    weekCount: weeks.length,
    week1OutcomeCount: outcomeCount,
    week1TaskCount: taskCount,
  };
}

export interface AdvanceWeekResult {
  advanced: boolean;
  weekIndex?: number;
  outcomeCount?: number;
  taskCount?: number;
}

/**
 * §8.3 cron step 3: "roll forward the current plan_week when a week boundary
 * passes." `plan_weeks` rows for the whole horizon already exist (created by
 * `generatePlan`); this only needs to generate `weekly_outcomes`/`tasks` for
 * whichever week now contains today, if it hasn't been generated yet. A
 * goal with no active plan, or whose current week is already generated (or
 * past the horizon), is a no-op.
 */
export async function advanceCurrentWeek(db: DB, goalId: string, userId: string): Promise<AdvanceWeekResult> {
  const { data: goal, error: goalError } = await db
    .from("goals")
    .select("outcome_statement, domain, horizon_weeks, started_on")
    .eq("id", goalId)
    .single();
  if (goalError || !goal) throw new Error(goalError?.message ?? "Goal not found");

  const { data: plan } = await db
    .from("plans")
    .select("id")
    .eq("goal_id", goalId)
    .eq("status", "active")
    .maybeSingle();
  if (!plan) return { advanced: false };

  const today = todayISO();
  const { data: week } = await db
    .from("plan_weeks")
    .select("id, week_index, starts_on, ends_on")
    .eq("plan_id", plan.id)
    .lte("starts_on", today)
    .gte("ends_on", today)
    .maybeSingle();
  if (!week) return { advanced: false };

  const { count: existingOutcomes } = await db
    .from("weekly_outcomes")
    .select("id", { count: "exact", head: true })
    .eq("plan_week_id", week.id);
  if ((existingOutcomes ?? 0) > 0) return { advanced: false };

  const capacity = await loadCapacityProfile(db, goalId);
  const eligibleProjects = await loadEligibleProjects(db, goalId);
  if (eligibleProjects.length === 0) return { advanced: false };

  const { data: priorTasks } = await db
    .from("tasks")
    .select("effort_minutes, status")
    .eq("goal_id", goalId)
    .gte("scheduled_for", weekBoundary(week.starts_on, -1).startsOn)
    .lt("scheduled_for", week.starts_on);
  const recentExecution: PlanWeekInput["recentExecution"] = priorTasks && priorTasks.length > 0
    ? {
        plannedMinutes: priorTasks.reduce((s, t) => s + t.effort_minutes, 0),
        completedMinutes: priorTasks.filter((t) => t.status === "done").reduce((s, t) => s + t.effort_minutes, 0),
        note: "trailing week, prior to this rollover",
      }
    : null;

  const horizonWeeks = goal.horizon_weeks ?? 12;
  const weeksRemaining = Math.max(1, horizonWeeks - week.week_index);

  const { outcomeCount, taskCount } = await persistWeekPlan(
    db,
    goalId,
    userId,
    week.id,
    { weekIndex: week.week_index, startsOn: week.starts_on, endsOn: week.ends_on },
    weeksRemaining,
    goal.outcome_statement,
    goal.domain,
    eligibleProjects,
    capacity,
    recentExecution,
  );

  return { advanced: true, weekIndex: week.week_index, outcomeCount, taskCount };
}
