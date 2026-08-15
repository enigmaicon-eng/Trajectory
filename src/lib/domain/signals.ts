// Deterministic signal computation (§5.5). All comparable-over-time
// definitions live here, in TypeScript, never in a prompt — the UI must be
// able to answer "why does it say that?" from these functions plus the raw
// counters alone. No I/O, no framework imports.
//
// Two formulas ("effort variance" feeding plan confidence, and "data
// sufficiency") aren't fully specified in the architecture doc beyond their
// role — the concrete formulas below are this implementation's documented
// choice, not a re-derivation of a spec value.

import { addWeeks, daysBetween, type ISODate } from "./dates";
import type { NodeHealth } from "./types";

export interface DailyExecutionPoint {
  date: ISODate;
  plannedMinutes: number;
  completedMinutes: number;
  /** Any task done, or a check-in with minutes_spent > 0 (§5.5 momentum definition). */
  active: boolean;
}

export type SignalValue<T> = { status: "known"; value: T } | { status: "unknown"; reason: string };

/** EWMA (alpha=0.3) over trailing daily "active day" booleans, scaled 0-100. Unknown under 7 days of data. */
export function computeMomentum(dailyActive: boolean[]): SignalValue<number> {
  if (dailyActive.length < 7) {
    return { status: "unknown", reason: "fewer than 7 days of data" };
  }
  const alpha = 0.3;
  let ewma = dailyActive[0] ? 1 : 0;
  for (let i = 1; i < dailyActive.length; i++) {
    ewma = alpha * (dailyActive[i] ? 1 : 0) + (1 - alpha) * ewma;
  }
  return { status: "known", value: Math.round(ewma * 1000) / 10 };
}

/** completed / planned effort minutes over the trailing window. Unknown under 7 days of plan history. */
export function computeExecutionRate(
  daily: Pick<DailyExecutionPoint, "plannedMinutes" | "completedMinutes">[],
): SignalValue<number> {
  if (daily.length < 7) {
    return { status: "unknown", reason: "fewer than 7 days of plan history" };
  }
  const planned = daily.reduce((s, d) => s + d.plannedMinutes, 0);
  const completed = daily.reduce((s, d) => s + d.completedMinutes, 0);
  return { status: "known", value: planned === 0 ? 0 : completed / planned };
}

/**
 * Variance of the daily completed/planned ratio, clamped to [0, 1] — this
 * implementation's proxy for "how erratic is execution day to day," feeding
 * plan confidence's (1 - effort_variance) term. 0 when fewer than 2 days
 * have planned effort (no variance signal available).
 */
export function computeEffortVariance(
  daily: Pick<DailyExecutionPoint, "plannedMinutes" | "completedMinutes">[],
): number {
  const ratios = daily.filter((d) => d.plannedMinutes > 0).map((d) => d.completedMinutes / d.plannedMinutes);
  if (ratios.length < 2) return 0;
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const variance = ratios.reduce((s, r) => s + (r - mean) ** 2, 0) / ratios.length;
  return Math.min(1, variance);
}

/** This implementation's proxy for data_sufficiency: days of history / 14, clamped to [0, 1]. */
export function computeDataSufficiency(daysOfHistory: number): number {
  return Math.max(0, Math.min(1, daysOfHistory / 14));
}

export interface PlanConfidenceInputs {
  feasibilityConfidence: number | null;
  executionRate: SignalValue<number>;
  effortVariance: number;
  dataSufficiency: number;
}

export interface PlanConfidenceResult {
  value: number;
  lowConfidenceLimitedData: boolean;
}

/** w1*feasibility_confidence + w2*clamp(execution_rate) + w3*(1-effort_variance) + w4*data_sufficiency. */
export function computePlanConfidence(inputs: PlanConfidenceInputs): PlanConfidenceResult {
  const W_FEASIBILITY = 0.35;
  const W_EXECUTION = 0.3;
  const W_VARIANCE = 0.15;
  const W_SUFFICIENCY = 0.2;

  const feasibility = inputs.feasibilityConfidence ?? 0.5; // neutral prior when no assessment on record
  const execution =
    inputs.executionRate.status === "known" ? Math.max(0, Math.min(1, inputs.executionRate.value)) : 0.5;

  const value =
    W_FEASIBILITY * feasibility +
    W_EXECUTION * execution +
    W_VARIANCE * (1 - inputs.effortVariance) +
    W_SUFFICIENCY * inputs.dataSufficiency;

  return {
    value: Math.max(0, Math.min(1, value)),
    lowConfidenceLimitedData: inputs.dataSufficiency < 0.5,
  };
}

export interface MilestoneRiskInput {
  nodeId: string;
  targetDate: ISODate | null;
  /** Sum of estimated_minutes across this milestone's not-yet-complete projects. */
  remainingMinutes: number;
  onCriticalPath: boolean;
}

export interface CapacityRateLike {
  idealMinutes: number;
  daysPerWeek: number;
}

export interface MilestoneRiskResult {
  nodeId: string;
  risk: NodeHealth;
  ratio: number | null;
  onCriticalPath: boolean;
}

/** required_remaining_minutes / projected_available_minutes_before_target. <=0.8 on_track, <=1.0 at_risk, >1.0 off_track. Unknown with no target date. */
export function computeMilestoneRisk(
  milestone: MilestoneRiskInput,
  today: ISODate,
  capacity: CapacityRateLike,
): MilestoneRiskResult {
  if (!milestone.targetDate) {
    return { nodeId: milestone.nodeId, risk: "unknown", ratio: null, onCriticalPath: milestone.onCriticalPath };
  }

  const daysRemaining = daysBetween(today, milestone.targetDate);
  if (daysRemaining <= 0) {
    return {
      nodeId: milestone.nodeId,
      risk: milestone.remainingMinutes > 0 ? "off_track" : "on_track",
      ratio: null,
      onCriticalPath: milestone.onCriticalPath,
    };
  }

  const projectedAvailable = (daysRemaining / 7) * capacity.daysPerWeek * capacity.idealMinutes;
  const ratio =
    projectedAvailable > 0
      ? milestone.remainingMinutes / projectedAvailable
      : milestone.remainingMinutes > 0
        ? Number.POSITIVE_INFINITY
        : 0;

  const risk: NodeHealth = ratio <= 0.8 ? "on_track" : ratio <= 1.0 ? "at_risk" : "off_track";
  return { nodeId: milestone.nodeId, risk, ratio, onCriticalPath: milestone.onCriticalPath };
}

const RISK_RANK: Record<Exclude<NodeHealth, "unknown">, number> = { on_track: 0, at_risk: 1, off_track: 2 };

/** Worst milestone risk on the critical path (falls back to worst overall if none are on the critical path). */
export function computeGoalRisk(milestoneRisks: MilestoneRiskResult[]): NodeHealth {
  const known = (list: MilestoneRiskResult[]) => list.filter((m) => m.risk !== "unknown");
  const critical = known(milestoneRisks.filter((m) => m.onCriticalPath));
  const pool = critical.length > 0 ? critical : known(milestoneRisks);
  if (pool.length === 0) return "unknown";
  return pool.reduce<NodeHealth>(
    (worst, m) => (RISK_RANK[m.risk as Exclude<NodeHealth, "unknown">] > RISK_RANK[worst as Exclude<NodeHealth, "unknown">] ? m.risk : worst),
    "on_track",
  );
}

/** Remaining critical-path effort / trailing realized weekly minutes, floored by critical-path week count. Unknown under 2 weeks of realized data. */
export function computeProjectedCompletion(
  today: ISODate,
  criticalPathRemainingMinutes: number,
  trailingWeeklyRealizedMinutes: number[],
  criticalPathWeekCountFloor: number,
): SignalValue<ISODate> {
  if (trailingWeeklyRealizedMinutes.length < 2) {
    return { status: "unknown", reason: "fewer than 2 weeks of realized execution data" };
  }
  const avgWeekly =
    trailingWeeklyRealizedMinutes.reduce((a, b) => a + b, 0) / trailingWeeklyRealizedMinutes.length;
  const weeksNeeded = avgWeekly > 0 ? criticalPathRemainingMinutes / avgWeekly : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(weeksNeeded)) {
    return { status: "unknown", reason: "no realized execution pace to project from" };
  }
  const weeks = Math.max(Math.ceil(weeksNeeded), criticalPathWeekCountFloor);
  return { status: "known", value: addWeeks(today, weeks) };
}
