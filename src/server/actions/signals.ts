import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types.generated";
import { criticalPath, CycleError } from "@/lib/domain/graph";
import type { GraphEdge, GraphNode } from "@/lib/domain/types";
import { addDays, daysBetween, daysInRange, todayISO, weekBoundary, type ISODate } from "@/lib/domain/dates";
import {
  computeDataSufficiency,
  computeEffortVariance,
  computeExecutionRate,
  computeGoalRisk,
  computeMilestoneRisk,
  computeMomentum,
  computePlanConfidence,
  computeProjectedCompletion,
  type DailyExecutionPoint,
  type MilestoneRiskResult,
} from "@/lib/domain/signals";

type DB = SupabaseClient<Database>;

export interface GoalSignalsSummary {
  capturedOn: ISODate;
  trailingWeeklyExecutionRates: number[];
  milestoneRisks: MilestoneRiskResult[];
  daysSinceLastActivity: number;
  weeklyCapacityMinutes: number;
}

/**
 * Computes every §5.5 signal for one goal and upserts today's `goal_signals`
 * row (deterministic — no AI). Returns a summary of the pieces `replan.ts`'s
 * trigger evaluation needs, so the cron job (Phase 5) doesn't have to
 * re-derive them.
 */
export async function computeAndPersistGoalSignals(db: DB, goalId: string): Promise<GoalSignalsSummary> {
  const today = todayISO();
  const windowStart = addDays(today, -35); // covers 21d momentum lookback + 4 full prior weeks

  const { data: goal, error: goalError } = await db
    .from("goals")
    .select("user_id, started_on")
    .eq("id", goalId)
    .single();
  if (goalError || !goal) throw new Error(goalError?.message ?? "Goal not found");

  const { data: assessment } = await db
    .from("feasibility_assessments")
    .select("confidence")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: capacityRow } = await db
    .from("capacity_profiles")
    .select("ideal_minutes, days_per_week")
    .eq("goal_id", goalId)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  const capacity = { idealMinutes: capacityRow?.ideal_minutes ?? 60, daysPerWeek: capacityRow?.days_per_week ?? 5 };
  const weeklyCapacityMinutes = capacity.idealMinutes * capacity.daysPerWeek;

  const { data: nodeRows } = await db
    .from("goal_nodes")
    .select("id, kind, parent_id, estimated_minutes, status, target_date")
    .eq("goal_id", goalId);
  const { data: edgeRows } = await db
    .from("node_dependencies")
    .select("from_node_id, to_node_id, type")
    .eq("goal_id", goalId);
  const nodes = nodeRows ?? [];
  const edges = edgeRows ?? [];

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

  let criticalIds = new Set<string>();
  try {
    criticalIds = criticalPath(graphNodes, graphEdges).criticalNodeIds;
  } catch (err) {
    // Defensive only, mirrors map/page.tsx: decompose/replan keep the graph
    // acyclic, so this means a later manual edit reintroduced a cycle.
    if (!(err instanceof CycleError)) throw err;
  }
  const criticalPathRemainingMinutes = nodes
    .filter((n) => n.kind === "project" && criticalIds.has(n.id) && n.status !== "complete")
    .reduce((sum, n) => sum + (n.estimated_minutes ?? 0), 0);
  const criticalPathWeekCount =
    weeklyCapacityMinutes > 0 ? Math.ceil(criticalPathRemainingMinutes / weeklyCapacityMinutes) : 0;

  const milestoneRisks = nodes
    .filter((n) => n.kind === "milestone")
    .map((m) => {
      const remainingMinutes = nodes
        .filter((p) => p.kind === "project" && p.parent_id === m.id && p.status !== "complete")
        .reduce((sum, p) => sum + (p.estimated_minutes ?? 0), 0);
      return computeMilestoneRisk(
        { nodeId: m.id, targetDate: m.target_date, remainingMinutes, onCriticalPath: criticalIds.has(m.id) },
        today,
        capacity,
      );
    });
  const goalRiskLevel = computeGoalRisk(milestoneRisks);

  const { data: taskRows } = await db
    .from("tasks")
    .select("scheduled_for, effort_minutes, status")
    .eq("goal_id", goalId)
    .gte("scheduled_for", windowStart)
    .lte("scheduled_for", today);
  const { data: checkinRows } = await db
    .from("checkins")
    .select("occurred_on, minutes_spent")
    .eq("goal_id", goalId)
    .eq("kind", "daily")
    .gte("occurred_on", windowStart)
    .lte("occurred_on", today);

  const tasks = taskRows ?? [];
  const checkins = checkinRows ?? [];

  const dailyExecution: DailyExecutionPoint[] = daysInRange(windowStart, today).map((date) => {
    const dayTasks = tasks.filter((t) => t.scheduled_for === date);
    const doneTasks = dayTasks.filter((t) => t.status === "done");
    const checkin = checkins.find((c) => c.occurred_on === date);
    return {
      date,
      plannedMinutes: dayTasks.reduce((sum, t) => sum + t.effort_minutes, 0),
      completedMinutes: doneTasks.reduce((sum, t) => sum + t.effort_minutes, 0),
      active: doneTasks.length > 0 || (checkin?.minutes_spent ?? 0) > 0,
    };
  });

  const momentum = computeMomentum(dailyExecution.slice(-21).map((d) => d.active));
  const trailing14 = dailyExecution.slice(-14);
  const executionRate = computeExecutionRate(trailing14);
  const effortVariance = computeEffortVariance(trailing14);
  const dataSufficiency = computeDataSufficiency(
    dailyExecution.filter((d) => d.plannedMinutes > 0 || d.active).length,
  );
  const planConfidence = computePlanConfidence({
    feasibilityConfidence: assessment?.confidence ?? null,
    executionRate,
    effortVariance,
    dataSufficiency,
  });

  const weeklyRealizedMinutes: number[] = [];
  const trailingWeeklyExecutionRates: number[] = [];
  for (let i = 4; i >= 1; i--) {
    const w = weekBoundary(today, -i);
    const weekTasks = tasks.filter((t) => t.scheduled_for && t.scheduled_for >= w.startsOn && t.scheduled_for <= w.endsOn);
    const planned = weekTasks.reduce((sum, t) => sum + t.effort_minutes, 0);
    const completed = weekTasks.filter((t) => t.status === "done").reduce((sum, t) => sum + t.effort_minutes, 0);
    weeklyRealizedMinutes.push(completed);
    trailingWeeklyExecutionRates.push(planned > 0 ? completed / planned : 0);
  }

  const projectedCompletion = computeProjectedCompletion(
    today,
    criticalPathRemainingMinutes,
    weeklyRealizedMinutes,
    criticalPathWeekCount,
  );

  const lastActiveDate = [...dailyExecution].reverse().find((d) => d.active)?.date ?? null;
  const daysSinceLastActivity = lastActiveDate
    ? daysBetween(lastActiveDate, today)
    : daysBetween(goal.started_on ?? today, today);

  const { error: upsertError } = await db.from("goal_signals").upsert(
    {
      goal_id: goalId,
      user_id: goal.user_id,
      captured_on: today,
      momentum: momentum.status === "known" ? momentum.value : null,
      execution_rate: executionRate.status === "known" ? executionRate.value : null,
      plan_confidence: planConfidence.value,
      risk_level: goalRiskLevel,
      projected_completion_date: projectedCompletion.status === "known" ? projectedCompletion.value : null,
      inputs: {
        weeklyRealizedMinutes,
        trailingWeeklyExecutionRates,
        criticalPathRemainingMinutes,
        criticalPathWeekCount,
        daysSinceLastActivity,
      },
      explanation: {
        momentum:
          momentum.status === "known"
            ? { value: momentum.value, basis: "EWMA(0.3) of daily activity, 21-day window" }
            : { caveat: momentum.reason },
        executionRate:
          executionRate.status === "known"
            ? { value: executionRate.value, basis: "completed/planned minutes, 14-day window" }
            : { caveat: executionRate.reason },
        planConfidence: {
          value: planConfidence.value,
          basis: "0.35*feasibility + 0.30*execution + 0.15*(1-variance) + 0.20*data_sufficiency",
          caveat: planConfidence.lowConfidenceLimitedData ? "low confidence: limited data" : null,
        },
        riskLevel: { value: goalRiskLevel, basis: "worst risk among critical-path milestones" },
        projectedCompletion:
          projectedCompletion.status === "known"
            ? { value: projectedCompletion.value, basis: "critical-path remaining effort / trailing 4-week realized pace" }
            : { caveat: projectedCompletion.reason },
      },
    },
    { onConflict: "goal_id,captured_on" },
  );
  if (upsertError) throw new Error(`Failed to persist goal signals: ${upsertError.message}`);

  return { capturedOn: today, trailingWeeklyExecutionRates, milestoneRisks, daysSinceLastActivity, weeklyCapacityMinutes };
}
