import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types.generated";
import { criticalPath, CycleError } from "@/lib/domain/graph";
import type { GraphEdge, GraphNode } from "@/lib/domain/types";
import { addDays, daysBetween, daysInRange, todayISO, weekBoundary, type ISODate } from "@/lib/domain/dates";
import { formatMinutes, formatPercent } from "@/lib/format";
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
    .eq("goal_id", goalId)
    .is("removed_at", null);
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

  // A goal a few days old still fills a fixed-length trailing window with
  // padding for days before it existed — without clamping to how long the
  // goal has actually been active, a 2-day-old goal would silently satisfy
  // computeMomentum's "7 days of data" floor with 19 padded "inactive" days
  // and report a confident, misleadingly low momentum instead of "unknown."
  const daysSinceStart = daysBetween(goal.started_on ?? today, today) + 1;
  const momentumWindow = dailyExecution.slice(-Math.min(21, daysSinceStart));
  const executionWindow = dailyExecution.slice(-Math.min(14, daysSinceStart));

  const momentum = computeMomentum(momentumWindow.map((d) => d.active));
  const trailing14 = executionWindow;
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
        // §13.5: this panel renders as database content, not narration — every
        // string here is baked once, at computation time, from the concrete
        // numbers behind it. No raw formula notation (AC-9.36's spirit: this
        // is user-facing copy) — "meaning" is the fixed, plain-language
        // definition; "basis" is this goal's actual numbers.
        momentum:
          momentum.status === "known"
            ? {
                value: momentum.value,
                meaning: "How many of the last 21 days had any activity, weighted so recent days count more.",
                basis: `${momentumWindow.filter((d) => d.active).length} of the last ${momentumWindow.length} day(s) were active`,
              }
            : { caveat: momentum.reason },
        executionRate:
          executionRate.status === "known"
            ? {
                value: executionRate.value,
                meaning: "Completed effort divided by what was planned, over the trailing window.",
                basis: `${formatMinutes(trailing14.reduce((s, d) => s + d.completedMinutes, 0))} completed of ${formatMinutes(trailing14.reduce((s, d) => s + d.plannedMinutes, 0))} planned, last ${trailing14.length} day(s)`,
              }
            : { caveat: executionRate.reason },
        planConfidence: {
          value: planConfidence.value,
          meaning: "A blend of how realistic the plan was judged, recent execution, day-to-day consistency, and how much history exists yet.",
          basis: `feasibility judged at ${formatPercent(assessment?.confidence ?? 0.5)}, execution at ${executionRate.status === "known" ? formatPercent(executionRate.value) : "unknown"}, ${dailyExecution.filter((d) => d.plannedMinutes > 0 || d.active).length} day(s) of history`,
          caveat: planConfidence.lowConfidenceLimitedData ? "Limited history so far — this will sharpen with more days of execution." : null,
        },
        riskLevel: {
          value: goalRiskLevel,
          meaning: "The worst risk among milestones on the critical path.",
          basis: "on_track ≤80% of runway needed, at_risk ≤100%, off_track beyond that",
        },
        projectedCompletion:
          projectedCompletion.status === "known"
            ? {
                value: projectedCompletion.value,
                meaning: "Remaining critical-path effort divided by your realized weekly pace, over the last 4 weeks.",
                basis: `${formatMinutes(criticalPathRemainingMinutes)} of critical-path work remaining at your recent pace`,
              }
            : { caveat: projectedCompletion.reason },
      },
    },
    { onConflict: "goal_id,captured_on" },
  );
  if (upsertError) throw new Error(`Failed to persist goal signals: ${upsertError.message}`);

  return { capturedOn: today, trailingWeeklyExecutionRates, milestoneRisks, daysSinceLastActivity, weeklyCapacityMinutes };
}
