// Replan trigger detection (§5.6). Pure threshold checks over
// already-computed signals/history — the diagnosis narrative and the patch
// itself come from the `replan` AI module; this module only decides *that*
// something needs attention, deterministically and reproducibly. No I/O.

import type { NodeHealth } from "./types";

/** low_execution: execution rate < 0.5 for 2 consecutive weeks. */
export function detectLowExecution(trailingWeeklyExecutionRates: number[]): boolean {
  if (trailingWeeklyExecutionRates.length < 2) return false;
  return trailingWeeklyExecutionRates.slice(-2).every((r) => r < 0.5);
}

/** ahead_of_schedule: execution rate > 1.4 for 2 consecutive weeks. */
export function detectAheadOfSchedule(trailingWeeklyExecutionRates: number[]): boolean {
  if (trailingWeeklyExecutionRates.length < 2) return false;
  return trailingWeeklyExecutionRates.slice(-2).every((r) => r > 1.4);
}

/** milestone_off_track: any critical-path milestone at off_track. */
export function detectMilestoneOffTrack(
  milestoneRisks: { onCriticalPath: boolean; risk: NodeHealth }[],
): boolean {
  return milestoneRisks.some((m) => m.onCriticalPath && m.risk === "off_track");
}

/** capacity_changed: new weekly capacity differs from the prior by >25%. */
export function detectCapacityChanged(previousWeeklyMinutes: number, newWeeklyMinutes: number): boolean {
  if (previousWeeklyMinutes === 0) return newWeeklyMinutes !== 0;
  return Math.abs(newWeeklyMinutes - previousWeeklyMinutes) / previousWeeklyMinutes > 0.25;
}

/** missed_checkins: no completed task and no check-in for 10+ consecutive days. */
export function detectMissedCheckins(daysSinceLastActivity: number): boolean {
  return daysSinceLastActivity >= 10;
}

export type ReplanTriggerKind =
  | "low_execution"
  | "milestone_off_track"
  | "capacity_changed"
  | "missed_checkins"
  | "ahead_of_schedule";

export interface ReplanEvaluationInputs {
  trailingWeeklyExecutionRates: number[];
  milestoneRisks: { onCriticalPath: boolean; risk: NodeHealth }[];
  capacityChange: { previousWeeklyMinutes: number; newWeeklyMinutes: number } | null;
  daysSinceLastActivity: number;
}

export interface DetectedTrigger {
  kind: ReplanTriggerKind;
  detail: Record<string, unknown>;
}

/**
 * Evaluates every signal-driven trigger (§5.6) against the day's inputs. Does
 * NOT include `dependency_change` / `priority_change` / `user_requested` —
 * those are event-driven (fired directly by the action that causes them),
 * not something a daily signal snapshot can detect.
 */
export function evaluateReplanTriggers(inputs: ReplanEvaluationInputs): DetectedTrigger[] {
  const triggers: DetectedTrigger[] = [];

  if (detectLowExecution(inputs.trailingWeeklyExecutionRates)) {
    triggers.push({
      kind: "low_execution",
      detail: { trailingWeeklyExecutionRates: inputs.trailingWeeklyExecutionRates.slice(-2) },
    });
  }
  if (detectAheadOfSchedule(inputs.trailingWeeklyExecutionRates)) {
    triggers.push({
      kind: "ahead_of_schedule",
      detail: { trailingWeeklyExecutionRates: inputs.trailingWeeklyExecutionRates.slice(-2) },
    });
  }
  if (detectMilestoneOffTrack(inputs.milestoneRisks)) {
    triggers.push({
      kind: "milestone_off_track",
      detail: { offTrackCriticalPathCount: inputs.milestoneRisks.filter((m) => m.onCriticalPath && m.risk === "off_track").length },
    });
  }
  if (inputs.capacityChange && detectCapacityChanged(inputs.capacityChange.previousWeeklyMinutes, inputs.capacityChange.newWeeklyMinutes)) {
    triggers.push({ kind: "capacity_changed", detail: inputs.capacityChange });
  }
  if (detectMissedCheckins(inputs.daysSinceLastActivity)) {
    triggers.push({ kind: "missed_checkins", detail: { daysSinceLastActivity: inputs.daysSinceLastActivity } });
  }

  return triggers;
}
