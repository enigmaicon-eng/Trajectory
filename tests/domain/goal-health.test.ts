import { describe, expect, it } from "vitest";
import { explainGoalHealth, pickWorstMilestone, type GoalHealthInputs, type MilestoneCandidate } from "@/lib/domain/goal-health";

const base: GoalHealthInputs = {
  dataSufficient: true,
  executionRate: { status: "known", value: 1.0 },
  trailingWeeklyExecutionRates: [0.9, 0.95, 1.0],
  worstMilestone: null,
  projectedCompletion: { status: "unknown", reason: "fewer than 2 weeks of realized execution data" },
  targetDate: null,
};

describe("explainGoalHealth", () => {
  it("insufficient data: says so explicitly rather than rendering a confident status", () => {
    const result = explainGoalHealth({ ...base, dataSufficient: false });
    expect(result.driver).toBe("insufficient_data");
    expect(result.headline).toBe("Not enough data yet. After seven days of execution, these become meaningful.");
  });

  it("strong execution: on-pace effort with nothing else wrong reads as on track", () => {
    const result = explainGoalHealth({ ...base, executionRate: { status: "known", value: 1.05 } });
    expect(result.driver).toBe("on_track");
  });

  it("strong execution: well above plan is named as ahead, not just 'on track'", () => {
    const result = explainGoalHealth({ ...base, executionRate: { status: "known", value: 1.6 } });
    expect(result.driver).toBe("ahead");
  });

  it("declining execution: a sharp drop from recent pace is named as declining, not just low", () => {
    const result = explainGoalHealth({
      ...base,
      executionRate: { status: "known", value: 0.3 },
      trailingWeeklyExecutionRates: [0.9, 0.85, 0.3],
    });
    expect(result.driver).toBe("declining_execution");
  });

  it("declining execution: a flat, steadily low rate is 'low', not 'declining' — there's no drop to name", () => {
    const result = explainGoalHealth({
      ...base,
      executionRate: { status: "known", value: 0.3 },
      trailingWeeklyExecutionRates: [0.3, 0.3, 0.3],
    });
    expect(result.driver).toBe("low_execution");
  });

  it("missed milestones: an off-track critical-path milestone is named specifically", () => {
    const result = explainGoalHealth({
      ...base,
      worstMilestone: { title: "Ship case study #2", risk: "off_track" },
    });
    expect(result.driver).toBe("off_track_milestone");
    expect(result.headline).toContain("Ship case study #2");
  });

  it("missed milestones: off-track outranks a merely declining execution rate", () => {
    const result = explainGoalHealth({
      ...base,
      executionRate: { status: "known", value: 0.3 },
      trailingWeeklyExecutionRates: [0.9, 0.85, 0.3],
      worstMilestone: { title: "Ship case study #2", risk: "off_track" },
    });
    expect(result.driver).toBe("off_track_milestone");
  });

  it("at-risk (not yet off-track) milestones are named too, but rank below execution problems", () => {
    const result = explainGoalHealth({
      ...base,
      worstMilestone: { title: "Applications", risk: "at_risk" },
    });
    expect(result.driver).toBe("at_risk_milestone");
    expect(result.headline).toContain("Applications");
  });

  it("unrealistic timeline: pace is fine but the projection lands after the target date", () => {
    const result = explainGoalHealth({
      ...base,
      projectedCompletion: { status: "known", value: "2026-12-14" },
      targetDate: "2026-11-30",
    });
    expect(result.driver).toBe("timeline_risk");
  });

  it("unrealistic timeline: no alarm when the projection lands on or before the target", () => {
    const result = explainGoalHealth({
      ...base,
      projectedCompletion: { status: "known", value: "2026-11-15" },
      targetDate: "2026-11-30",
    });
    expect(result.driver).not.toBe("timeline_risk");
  });

  it("a declining rate is named ahead of a distant timeline risk", () => {
    const result = explainGoalHealth({
      ...base,
      executionRate: { status: "known", value: 0.3 },
      trailingWeeklyExecutionRates: [0.9, 0.85, 0.3],
      projectedCompletion: { status: "known", value: "2026-12-14" },
      targetDate: "2026-11-30",
    });
    expect(result.driver).toBe("declining_execution");
  });
});

describe("pickWorstMilestone", () => {
  function m(overrides: Partial<MilestoneCandidate> = {}): MilestoneCandidate {
    return { title: "Milestone", status: "in_progress", risk: "on_track", onCriticalPath: false, ...overrides };
  }

  it("returns null when nothing is off_track or at_risk", () => {
    expect(pickWorstMilestone([m({ risk: "on_track" }), m({ risk: "unknown" })])).toBeNull();
  });

  it("off_track outranks at_risk", () => {
    const result = pickWorstMilestone([
      m({ title: "A", risk: "at_risk" }),
      m({ title: "B", risk: "off_track" }),
    ]);
    expect(result).toEqual({ title: "B", risk: "off_track" });
  });

  it("within the same risk tier, a critical-path milestone outranks one that isn't", () => {
    const result = pickWorstMilestone([
      m({ title: "Off critical path", risk: "off_track", onCriticalPath: false }),
      m({ title: "On critical path", risk: "off_track", onCriticalPath: true }),
    ]);
    expect(result?.title).toBe("On critical path");
  });

  it("never names a completed or dropped milestone as the problem, even with a stale off_track risk", () => {
    expect(pickWorstMilestone([m({ status: "complete", risk: "off_track" })])).toBeNull();
    expect(pickWorstMilestone([m({ status: "dropped", risk: "off_track" })])).toBeNull();
  });
});
