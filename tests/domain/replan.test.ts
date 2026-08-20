import { describe, expect, it } from "vitest";
import {
  detectAheadOfSchedule,
  detectCapacityChanged,
  detectLowExecution,
  detectMilestoneOffTrack,
  detectMissedCheckins,
  evaluateReplanTriggers,
} from "@/lib/domain/replan";
import { TRIGGER_LEAD } from "@/lib/replan-copy";

describe("detectLowExecution", () => {
  it("fires when the last 2 weeks are both under 0.5", () => {
    expect(detectLowExecution([0.9, 0.4, 0.3])).toBe(true);
  });
  it("does not fire if either of the last 2 weeks is >= 0.5", () => {
    expect(detectLowExecution([0.4, 0.6, 0.4])).toBe(false);
  });
  it("does not fire with fewer than 2 weeks of history", () => {
    expect(detectLowExecution([0.1])).toBe(false);
  });
});

describe("detectAheadOfSchedule", () => {
  it("fires when the last 2 weeks are both over 1.4", () => {
    expect(detectAheadOfSchedule([1.0, 1.5, 1.6])).toBe(true);
  });
  it("does not fire otherwise", () => {
    expect(detectAheadOfSchedule([1.5, 1.2])).toBe(false);
  });
});

describe("detectMilestoneOffTrack", () => {
  it("fires when a critical-path milestone is off_track", () => {
    expect(detectMilestoneOffTrack([{ onCriticalPath: true, risk: "off_track" }])).toBe(true);
  });
  it("does not fire for an off-critical-path milestone", () => {
    expect(detectMilestoneOffTrack([{ onCriticalPath: false, risk: "off_track" }])).toBe(false);
  });
});

describe("detectCapacityChanged", () => {
  it("fires when the change exceeds 25%", () => {
    expect(detectCapacityChanged(400, 250)).toBe(true);
  });
  it("does not fire for a small change", () => {
    expect(detectCapacityChanged(400, 420)).toBe(false);
  });
  it("fires when going from zero to any nonzero capacity", () => {
    expect(detectCapacityChanged(0, 100)).toBe(true);
  });
});

describe("detectMissedCheckins", () => {
  it("fires at 10+ days of inactivity", () => {
    expect(detectMissedCheckins(10)).toBe(true);
    expect(detectMissedCheckins(9)).toBe(false);
  });
});

describe("evaluateReplanTriggers", () => {
  it("returns every applicable trigger, not just the first", () => {
    const triggers = evaluateReplanTriggers({
      trailingWeeklyExecutionRates: [0.9, 0.3, 0.2],
      milestoneRisks: [{ onCriticalPath: true, risk: "off_track" }],
      capacityChange: { previousWeeklyMinutes: 400, newWeeklyMinutes: 100 },
      daysSinceLastActivity: 12,
    });
    const kinds = triggers.map((t) => t.kind).sort();
    expect(kinds).toEqual(["capacity_changed", "low_execution", "milestone_off_track", "missed_checkins"].sort());
  });

  it("returns nothing when everything is healthy", () => {
    const triggers = evaluateReplanTriggers({
      trailingWeeklyExecutionRates: [0.9, 0.95],
      milestoneRisks: [{ onCriticalPath: true, risk: "on_track" }],
      capacityChange: null,
      daysSinceLastActivity: 1,
    });
    expect(triggers).toEqual([]);
  });
});

// Minimum Viable Progress: a run of low-capacity days must produce a plan
// adjustment, not a verdict on the user. §11.1 rule 6 — the system takes
// responsibility for the plan, never frames a quiet stretch as a failure.
describe("repeated low-capacity days", () => {
  it("keeps firing low_execution across an extended low-capacity stretch, not just the first two weeks", () => {
    const sixWeeksAtQuarterPace = [0.9, 0.2, 0.2, 0.2, 0.2, 0.2];
    expect(detectLowExecution(sixWeeksAtQuarterPace)).toBe(true);
  });

  it("recovers as soon as two consecutive weeks clear the threshold again", () => {
    const recovering = [0.2, 0.2, 0.2, 0.6, 0.7];
    expect(detectLowExecution(recovering)).toBe(false);
  });

  it("the trigger produced from a low-execution stretch carries the non-punitive lead line", () => {
    const triggers = evaluateReplanTriggers({
      trailingWeeklyExecutionRates: [0.9, 0.2, 0.2, 0.2],
      milestoneRisks: [],
      capacityChange: null,
      daysSinceLastActivity: 1,
    });
    const lowExecution = triggers.find((t) => t.kind === "low_execution");
    expect(lowExecution).toBeDefined();
    expect(TRIGGER_LEAD.low_execution).toBe("Your week changed. Let's adjust the plan.");
  });

  it("non-punitive lead copy never uses failure or guilt language", () => {
    const banned = /\b(fail(ed)?|missed the mark|behind schedule!|streak|oops|uh-oh|sorry)\b/i;
    for (const lead of Object.values(TRIGGER_LEAD)) {
      expect(lead).not.toMatch(banned);
      expect(lead).not.toContain("!");
    }
  });
});
