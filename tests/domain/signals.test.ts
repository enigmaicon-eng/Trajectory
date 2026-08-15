import { describe, expect, it } from "vitest";
import {
  computeDataSufficiency,
  computeEffortVariance,
  computeExecutionRate,
  computeGoalRisk,
  computeMilestoneRisk,
  computeMomentum,
  computePlanConfidence,
  computeProjectedCompletion,
  type MilestoneRiskResult,
} from "@/lib/domain/signals";

describe("computeMomentum", () => {
  it("is unknown under 7 days of data", () => {
    const result = computeMomentum([true, true, false]);
    expect(result.status).toBe("unknown");
  });

  it("is 100 for a fully active streak", () => {
    const result = computeMomentum(Array(10).fill(true));
    expect(result).toEqual({ status: "known", value: 100 });
  });

  it("is 0 for a fully inactive streak", () => {
    const result = computeMomentum(Array(10).fill(false));
    expect(result).toEqual({ status: "known", value: 0 });
  });

  it("decays toward 0 after activity stops", () => {
    const active = Array(10).fill(true);
    const thenInactive = [...active, false, false, false];
    const r1 = computeMomentum(active);
    const r2 = computeMomentum(thenInactive);
    if (r1.status === "known" && r2.status === "known") {
      expect(r2.value).toBeLessThan(r1.value);
    } else {
      throw new Error("expected known values");
    }
  });
});

describe("computeExecutionRate", () => {
  it("is unknown under 7 days", () => {
    expect(computeExecutionRate([{ plannedMinutes: 30, completedMinutes: 30 }]).status).toBe("unknown");
  });

  it("is completed/planned over the window", () => {
    const daily = Array(7).fill({ plannedMinutes: 60, completedMinutes: 30 });
    expect(computeExecutionRate(daily)).toEqual({ status: "known", value: 0.5 });
  });

  it("is 0 when nothing was planned", () => {
    const daily = Array(7).fill({ plannedMinutes: 0, completedMinutes: 0 });
    expect(computeExecutionRate(daily)).toEqual({ status: "known", value: 0 });
  });
});

describe("computeEffortVariance", () => {
  it("is 0 with fewer than 2 planned days", () => {
    expect(computeEffortVariance([{ plannedMinutes: 30, completedMinutes: 15 }])).toBe(0);
  });

  it("is 0 when every day executes at the same ratio", () => {
    const daily = Array(5).fill({ plannedMinutes: 60, completedMinutes: 30 });
    expect(computeEffortVariance(daily)).toBe(0);
  });

  it("is positive when the ratio swings day to day", () => {
    const daily = [
      { plannedMinutes: 60, completedMinutes: 60 },
      { plannedMinutes: 60, completedMinutes: 0 },
    ];
    expect(computeEffortVariance(daily)).toBeGreaterThan(0);
  });
});

describe("computeDataSufficiency", () => {
  it("clamps to [0, 1]", () => {
    expect(computeDataSufficiency(0)).toBe(0);
    expect(computeDataSufficiency(7)).toBe(0.5);
    expect(computeDataSufficiency(28)).toBe(1);
  });
});

describe("computePlanConfidence", () => {
  it("blends feasibility, execution, variance, and sufficiency within [0, 1]", () => {
    const result = computePlanConfidence({
      feasibilityConfidence: 0.8,
      executionRate: { status: "known", value: 0.9 },
      effortVariance: 0.1,
      dataSufficiency: 1,
    });
    expect(result.value).toBeGreaterThan(0);
    expect(result.value).toBeLessThanOrEqual(1);
    expect(result.lowConfidenceLimitedData).toBe(false);
  });

  it("flags low confidence when data sufficiency is under 0.5", () => {
    const result = computePlanConfidence({
      feasibilityConfidence: 0.8,
      executionRate: { status: "unknown", reason: "n/a" },
      effortVariance: 0,
      dataSufficiency: 0.2,
    });
    expect(result.lowConfidenceLimitedData).toBe(true);
  });
});

describe("computeMilestoneRisk", () => {
  const capacity = { idealMinutes: 60, daysPerWeek: 5 };

  it("is unknown with no target date", () => {
    const result = computeMilestoneRisk(
      { nodeId: "m1", targetDate: null, remainingMinutes: 100, onCriticalPath: true },
      "2026-08-14",
      capacity,
    );
    expect(result.risk).toBe("unknown");
  });

  it("is off_track when the target date has already passed with work remaining", () => {
    const result = computeMilestoneRisk(
      { nodeId: "m1", targetDate: "2026-08-01", remainingMinutes: 100, onCriticalPath: true },
      "2026-08-14",
      capacity,
    );
    expect(result.risk).toBe("off_track");
  });

  it("is on_track when remaining effort is comfortably within the runway", () => {
    // 4 weeks runway * 5 days * 60min = 1200min available; 100min remaining => ratio ~0.08
    const result = computeMilestoneRisk(
      { nodeId: "m1", targetDate: "2026-09-11", remainingMinutes: 100, onCriticalPath: true },
      "2026-08-14",
      capacity,
    );
    expect(result.risk).toBe("on_track");
  });

  it("is off_track when remaining effort exceeds the runway", () => {
    const result = computeMilestoneRisk(
      { nodeId: "m1", targetDate: "2026-08-21", remainingMinutes: 10_000, onCriticalPath: true },
      "2026-08-14",
      capacity,
    );
    expect(result.risk).toBe("off_track");
  });
});

describe("computeGoalRisk", () => {
  function risk(r: MilestoneRiskResult["risk"], onCriticalPath: boolean): MilestoneRiskResult {
    return { nodeId: "x", risk: r, ratio: null, onCriticalPath };
  }

  it("picks the worst risk among critical-path milestones", () => {
    const risks = [risk("on_track", true), risk("off_track", true), risk("at_risk", false)];
    expect(computeGoalRisk(risks)).toBe("off_track");
  });

  it("falls back to overall worst risk when nothing is on the critical path", () => {
    const risks = [risk("on_track", false), risk("at_risk", false)];
    expect(computeGoalRisk(risks)).toBe("at_risk");
  });

  it("is unknown when every risk is unknown", () => {
    expect(computeGoalRisk([risk("unknown", true)])).toBe("unknown");
  });
});

describe("computeProjectedCompletion", () => {
  it("is unknown with fewer than 2 weeks of realized data", () => {
    const result = computeProjectedCompletion("2026-08-14", 1000, [500], 2);
    expect(result.status).toBe("unknown");
  });

  it("projects forward using the average realized weekly pace, floored by critical-path weeks", () => {
    const result = computeProjectedCompletion("2026-08-14", 1000, [500, 500], 1);
    // 1000min remaining / 500min-avg-per-week = 2 weeks needed
    expect(result).toEqual({ status: "known", value: "2026-08-28" });
  });

  it("floors the projection at the critical-path week count even if pace would finish sooner", () => {
    const result = computeProjectedCompletion("2026-08-14", 100, [500, 500], 5);
    expect(result).toEqual({ status: "known", value: "2026-09-18" }); // 5 weeks floor
  });
});
