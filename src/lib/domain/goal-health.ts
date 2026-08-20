// Goal Health explanation (§13.5 "why this number", §0.2 "intelligence
// shows up as specificity"). §5.5's signals are individually useful but
// none of them, alone, answers "why is my goal in this state?" — this
// module synthesizes that one-sentence answer deterministically from the
// already-computed signals, in priority order from most specific/actionable
// to least, so the explanation always names the real driver rather than a
// generic status word. No I/O, no framework imports, no AI — like the rest
// of lib/domain, and per the Standing Answer rule (§0.5.1) this must work
// with the AI provider disabled.

import type { ISODate } from "./dates";
import type { SignalValue } from "./signals";

export interface WorstMilestone {
  title: string;
  risk: "off_track" | "at_risk";
}

export interface MilestoneCandidate {
  title: string;
  /** Deliberately a plain string, not the DB's node_status enum — this module stays decoupled from generated DB types, like the rest of lib/domain. */
  status: string;
  risk: "on_track" | "at_risk" | "off_track" | "unknown";
  onCriticalPath: boolean;
}

/**
 * The single milestone that best explains why the goal isn't fully healthy —
 * off_track outranks at_risk, and within a tier a critical-path milestone
 * outranks one that isn't (naming the actual bottleneck, §0.2). A completed
 * or dropped milestone is never named as a problem regardless of its
 * last-computed risk.
 */
export function pickWorstMilestone(milestones: MilestoneCandidate[]): WorstMilestone | null {
  const candidates = milestones.filter(
    (m) => m.status !== "complete" && m.status !== "dropped" && (m.risk === "off_track" || m.risk === "at_risk"),
  );
  if (candidates.length === 0) return null;
  const rank = (r: MilestoneCandidate["risk"]) => (r === "off_track" ? 2 : 1);
  const [worst] = [...candidates].sort(
    (a, b) => rank(b.risk) - rank(a.risk) || Number(b.onCriticalPath) - Number(a.onCriticalPath),
  );
  return { title: worst.title, risk: worst.risk as "off_track" | "at_risk" };
}

export interface GoalHealthInputs {
  /** Whether a signals snapshot exists at all — false before the first daily computation, or fewer than 7 days into a goal. */
  dataSufficient: boolean;
  executionRate: SignalValue<number>;
  /** Oldest first, most recent last. Empty if fewer than the trend window's worth of weeks exist. */
  trailingWeeklyExecutionRates: number[];
  /** The critical-path milestone in the worst state, if any is off_track or at_risk. */
  worstMilestone: WorstMilestone | null;
  projectedCompletion: SignalValue<ISODate>;
  targetDate: ISODate | null;
}

export type GoalHealthDriver =
  | "insufficient_data"
  | "off_track_milestone"
  | "declining_execution"
  | "timeline_risk"
  | "low_execution"
  | "at_risk_milestone"
  | "ahead"
  | "on_track";

export interface GoalHealthExplanation {
  headline: string;
  driver: GoalHealthDriver;
}

/** Recent weeks meaningfully worse than their own preceding average — not just "low," but getting worse. */
function isDeclining(rates: number[]): boolean {
  if (rates.length < 2) return false;
  const last = rates[rates.length - 1];
  const prior = rates.slice(0, -1);
  const priorAvg = prior.reduce((a, b) => a + b, 0) / prior.length;
  return priorAvg > 0 && last < priorAvg * 0.7 && last < 0.6;
}

export function explainGoalHealth(inputs: GoalHealthInputs): GoalHealthExplanation {
  if (!inputs.dataSufficient) {
    return {
      headline: "Not enough data yet. After seven days of execution, these become meaningful.",
      driver: "insufficient_data",
    };
  }

  if (inputs.worstMilestone?.risk === "off_track") {
    return { headline: `${inputs.worstMilestone.title} is off track — that's what's holding this goal back.`, driver: "off_track_milestone" };
  }

  if (isDeclining(inputs.trailingWeeklyExecutionRates)) {
    return { headline: "Execution has slowed compared to your recent pace.", driver: "declining_execution" };
  }

  if (
    inputs.projectedCompletion.status === "known" &&
    inputs.targetDate &&
    inputs.projectedCompletion.value > inputs.targetDate
  ) {
    return { headline: "Projected to finish after your target date at the current pace.", driver: "timeline_risk" };
  }

  if (inputs.executionRate.status === "known" && inputs.executionRate.value < 0.5) {
    return { headline: "Recent weeks have landed well under the planned effort.", driver: "low_execution" };
  }

  if (inputs.worstMilestone?.risk === "at_risk") {
    return { headline: `${inputs.worstMilestone.title} is at risk — worth watching.`, driver: "at_risk_milestone" };
  }

  if (inputs.executionRate.status === "known" && inputs.executionRate.value > 1.4) {
    return { headline: "Recent weeks have landed well ahead of plan.", driver: "ahead" };
  }

  return { headline: "Recent execution matches the plan.", driver: "on_track" };
}
