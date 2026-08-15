import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types.generated";
import { runPlanWeek } from "@/lib/ai/modules/plan_week";
import type { PlanWeekInput } from "@/lib/ai/modules/plan_week/input.schema";
import { readyNodes } from "@/lib/domain/graph";
import type { GraphEdge, GraphNode } from "@/lib/domain/types";
import { horizonEnd, todayISO, weekBoundaries } from "@/lib/domain/dates";
import { availableDaysInWeek, weekCapacityMinutes, type CapacityProfileLike } from "@/lib/domain/capacity";
import { scheduleTasks, type CandidateTaskLike } from "@/lib/domain/scheduler";

type DB = SupabaseClient<Database>;

export interface GeneratePlanResult {
  planId: string;
  weekCount: number;
  week1OutcomeCount: number;
  week1TaskCount: number;
}

/**
 * Creates the active plan for a goal: `plan_weeks` metadata rows (dates +
 * capacity budget) span the *entire* horizon deterministically, but only
 * week 0 gets AI-generated `weekly_outcomes`/`tasks` — matching AC-4.14's
 * <90s latency target (one `plan_week` call, not one per week of a
 * potentially 260-week horizon) and §8.3's cron, which rolls the plan
 * forward and (in Phase 5) generates each subsequent week lazily as it
 * arrives. Also usable for a replan: an existing active plan is superseded
 * first, matching plans' one-active-plan-per-goal constraint.
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

  const { data: capacityRow, error: capacityError } = await db
    .from("capacity_profiles")
    .select("ideal_minutes, normal_minutes, minimum_minutes, days_per_week, preferred_days, blackout_dates")
    .eq("goal_id", goalId)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (capacityError) throw new Error(capacityError.message);
  if (!capacityRow) throw new Error("generatePlan: no capacity profile on record — decompose must run first");

  const capacity: CapacityProfileLike = {
    idealMinutes: capacityRow.ideal_minutes,
    normalMinutes: capacityRow.normal_minutes,
    minimumMinutes: capacityRow.minimum_minutes,
    daysPerWeek: capacityRow.days_per_week,
    preferredDays: capacityRow.preferred_days,
    blackoutDates: capacityRow.blackout_dates,
  };

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
  if (nodes.length === 0) throw new Error("generatePlan: goal has no graph — decompose must run first");

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
  const eligibleProjects = nodes.filter(
    (n) => n.kind === "project" && readyIds.has(n.id) && n.status !== "complete" && n.status !== "dropped",
  );
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

  const week0 = weeks[0];
  const week0Id = weekIds[0];
  const availableDays = availableDaysInWeek(capacity, week0);

  const planWeekInput: PlanWeekInput = {
    outcomeStatement: goal.outcome_statement,
    domain: goal.domain ?? "other",
    weekIndex: 0,
    weeksRemaining: horizonWeeks,
    eligibleProjects: eligibleProjects.map((p) => ({
      id: p.id,
      title: p.title,
      verification: p.verification,
      estimatedMinutes: p.estimated_minutes ?? 0,
    })),
    capacity: {
      idealMinutes: capacity.idealMinutes,
      normalMinutes: capacity.normalMinutes,
      minimumMinutes: capacity.minimumMinutes,
      availableDayCount: Math.max(1, availableDays.length),
    },
    recentExecution: null,
  };

  const planWeekOutput = await runPlanWeek(planWeekInput, { userId, goalId, traceId: randomUUID(), db });

  const outcomeIdByTemp = new Map<string, string>();
  const outcomeRows = planWeekOutput.weeklyOutcomes.map((o) => {
    const id = randomUUID();
    outcomeIdByTemp.set(o.tempId, id);
    return {
      id,
      plan_week_id: week0Id,
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

  // Tasks the scheduler couldn't fit (over daily/weekly capacity, or past the
  // 5-task cap) are simply not persisted — plan_week's own AC-4.13 obligation
  // ("no week's planned effort exceeds capacity") is enforced here, by the
  // deterministic engine, not by trusting the model's arithmetic.
  const { scheduled } = scheduleTasks(candidateTasks, availableDays, capacity.idealMinutes);

  const taskRows = scheduled.map((t) => ({
    id: randomUUID(),
    plan_week_id: week0Id,
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

  const { error: activateError } = await db
    .from("plans")
    .update({ status: "active", activated_at: new Date().toISOString() })
    .eq("id", planId);
  if (activateError) throw new Error(`Failed to activate plan: ${activateError.message}`);

  return {
    planId,
    weekCount: weeks.length,
    week1OutcomeCount: outcomeRows.length,
    week1TaskCount: taskRows.length,
  };
}
