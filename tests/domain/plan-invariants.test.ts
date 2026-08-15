import { describe, expect, it } from "vitest";
import {
  applyPlanWeekInvariants,
  UnrepairablePlanWeekError,
  type CandidateTaskDraftLike,
  type WeeklyOutcomeDraftLike,
} from "@/lib/domain/plan-invariants";

function outcome(tempId: string, projectNodeId: string, priority = 1): WeeklyOutcomeDraftLike {
  return { tempId, projectNodeId, priority };
}
function candidateTask(tempId: string, outcomeTempId: string, effortMinutes = 30, why = "because"): CandidateTaskDraftLike {
  return { tempId, outcomeTempId, effortMinutes, why };
}

describe("applyPlanWeekInvariants", () => {
  it("passes through a valid draft unchanged", () => {
    const draft = {
      weeklyOutcomes: [outcome("o1", "p1")],
      candidateTasks: [candidateTask("t1", "o1")],
    };
    const result = applyPlanWeekInvariants(draft, new Set(["p1"]));
    expect(result).toEqual(draft);
  });

  it("drops outcomes referencing a project outside the eligible set", () => {
    const draft = {
      weeklyOutcomes: [outcome("o1", "p1"), outcome("o2", "unknown")],
      candidateTasks: [candidateTask("t1", "o1"), candidateTask("t2", "o2")],
    };
    const result = applyPlanWeekInvariants(draft, new Set(["p1"]));
    expect(result.weeklyOutcomes.map((o) => o.tempId)).toEqual(["o1"]);
    // task referencing the dropped outcome is dropped too (dangling outcomeTempId)
    expect(result.candidateTasks.map((t) => t.tempId)).toEqual(["t1"]);
  });

  it("throws UnrepairablePlanWeekError when no outcome survives", () => {
    const draft = { weeklyOutcomes: [outcome("o1", "unknown")], candidateTasks: [] };
    expect(() => applyPlanWeekInvariants(draft, new Set(["p1"]))).toThrow(UnrepairablePlanWeekError);
  });

  it("caps outcomes at maxOutcomes, keeping lowest-priority-number first", () => {
    const draft = {
      weeklyOutcomes: [outcome("o1", "p1", 3), outcome("o2", "p1", 1), outcome("o3", "p1", 2), outcome("o4", "p1", 1)],
      candidateTasks: [],
    };
    const result = applyPlanWeekInvariants(draft, new Set(["p1"]), 2);
    expect(result.weeklyOutcomes.map((o) => o.tempId)).toEqual(["o2", "o4"]);
  });

  it("drops tasks with an empty why", () => {
    const draft = {
      weeklyOutcomes: [outcome("o1", "p1")],
      candidateTasks: [candidateTask("t1", "o1", 30, ""), candidateTask("t2", "o1", 30, "because")],
    };
    const result = applyPlanWeekInvariants(draft, new Set(["p1"]));
    expect(result.candidateTasks.map((t) => t.tempId)).toEqual(["t2"]);
  });

  it("caps total tasks at maxTasks", () => {
    const draft = {
      weeklyOutcomes: [outcome("o1", "p1")],
      candidateTasks: [candidateTask("t1", "o1"), candidateTask("t2", "o1"), candidateTask("t3", "o1")],
    };
    const result = applyPlanWeekInvariants(draft, new Set(["p1"]), 3, 2);
    expect(result.candidateTasks).toHaveLength(2);
  });
});
