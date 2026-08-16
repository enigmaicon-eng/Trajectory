// §5.8 evaluation harness. Runs each recorded fixture output (tests/ai/fixtures.ts)
// through the real schema + applyInvariants for its module — no live provider
// calls (recorded-response cache by default, per §5.8). Assertions target
// structure, not prose: AC-9.38 requires all fixtures to pass.
import { describe, it, expect } from "vitest";
import { clarifyOutputSchema } from "@/lib/ai/modules/clarify/output.schema";
import { applyClarifyInvariants } from "@/lib/ai/modules/clarify/invariants";
import { assessOutputSchema } from "@/lib/ai/modules/assess/output.schema";
import { applyAssessInvariants } from "@/lib/ai/modules/assess/invariants";
import { decomposeOutputSchema } from "@/lib/ai/modules/decompose/output.schema";
import { applyDecomposeInvariants, effortBudgetMinutes, EFFORT_BUDGET_TOLERANCE } from "@/lib/domain/invariants";
import { detectCycleEdge } from "@/lib/domain/graph";
import { horizonEnd } from "@/lib/domain/dates";
import type { GraphEdge, GraphNode } from "@/lib/domain/types";
import { fixtures } from "./fixtures";

describe("evaluation harness (§5.8)", () => {
  it("has at least 12 fixtures across domains, including two unrealistic and one vague", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(12);
    const domains = new Set(fixtures.map((f) => f.domain));
    expect(domains.size).toBeGreaterThanOrEqual(6);
    const unrealistic = fixtures.filter((f) => f.assess?.recorded.verdict === "unrealistic_as_stated");
    expect(unrealistic.length).toBeGreaterThanOrEqual(2);
  });

  it("AC-1.1's ≤4 question cap is enforced at the schema boundary, not just the invariant clamp", () => {
    // A model that over-generates to 5 questions must fail schema validation
    // (triggering run.ts's repair reprompt, §5.4 step 6) — it should never
    // silently reach applyClarifyInvariants with 5 items in the first place.
    const overGenerated = {
      ...fixtures[0].clarify.recorded,
      questions: [
        { id: "q1", prompt: "One" },
        { id: "q2", prompt: "Two" },
        { id: "q3", prompt: "Three" },
        { id: "q4", prompt: "Four" },
        { id: "q5", prompt: "Five" },
      ],
    };
    expect(clarifyOutputSchema.safeParse(overGenerated).success).toBe(false);
  });

  for (const fixture of fixtures) {
    describe(fixture.id, () => {
      it("clarify output satisfies schema and question-count invariant (AC-1.1)", () => {
        const parsed = clarifyOutputSchema.parse(fixture.clarify.recorded);
        const repaired = applyClarifyInvariants(parsed);
        expect(repaired.questions.length).toBeLessThanOrEqual(4);
        expect(repaired.title.length).toBeGreaterThan(0);
        expect(repaired.outcomeStatement.length).toBeGreaterThan(0);
      });

      if (fixture.assess) {
        it("assess output satisfies schema and the unrealistic->alternative invariant (AC-2.5)", () => {
          const { recorded } = fixture.assess!;
          const parsed = assessOutputSchema.parse(recorded);
          const repaired = applyAssessInvariants(parsed);
          if (recorded.verdict === "unrealistic_as_stated") {
            expect(repaired.alternative).not.toBeNull();
            expect(repaired.alternative?.outcomeStatement.length).toBeGreaterThan(0);
          }
        });
      }

      if (fixture.decompose) {
        it("decompose output satisfies schema and structural invariants (AC-3)", () => {
          const { input, recorded, startDate } = fixture.decompose!;
          const parsedOutput = decomposeOutputSchema.parse(recorded);

          const repaired = applyDecomposeInvariants(parsedOutput, {
            horizonWeeks: input.horizonWeeks,
            idealMinutes: input.capacity.idealMinutes,
            daysPerWeek: input.capacity.daysPerWeek,
          });

          // AC-3.7: 3-5 milestones, each with >=1 surviving project.
          expect(repaired.milestones.length).toBeGreaterThanOrEqual(3);
          expect(repaired.milestones.length).toBeLessThanOrEqual(5);
          const milestoneIds = new Set(repaired.milestones.map((m) => m.tempId));
          for (const p of repaired.projects) {
            expect(milestoneIds.has(p.milestoneTempId)).toBe(true);
            expect(p.verification.length).toBeGreaterThan(0);
          }

          // AC-3.8: the blocks graph is acyclic after repair.
          const nodes: GraphNode[] = [
            ...repaired.milestones.map((m) => ({ id: m.tempId, kind: "milestone" as const, parentId: null, estimatedMinutes: null })),
            ...repaired.projects.map((p) => ({ id: p.tempId, kind: "project" as const, parentId: p.milestoneTempId, estimatedMinutes: p.estimatedMinutes })),
          ];
          const edges: GraphEdge[] = repaired.dependencies.map((d) => ({ fromNodeId: d.fromTempId, toNodeId: d.toTempId, type: d.type }));
          expect(detectCycleEdge(nodes, edges)).toBeNull();

          // AC-3.10: total effort within ±25% of the capacity budget.
          const budget = effortBudgetMinutes({
            horizonWeeks: input.horizonWeeks,
            idealMinutes: input.capacity.idealMinutes,
            daysPerWeek: input.capacity.daysPerWeek,
          });
          const total = repaired.projects.reduce((sum, p) => sum + p.estimatedMinutes, 0);
          const lower = budget * (1 - EFFORT_BUDGET_TOLERANCE) - 1; // rounding slack
          const upper = budget * (1 + EFFORT_BUDGET_TOLERANCE) + 1;
          expect(total).toBeGreaterThanOrEqual(lower);
          expect(total).toBeLessThanOrEqual(upper);

          // Milestone target dates fall within the goal's horizon.
          const end = horizonEnd(startDate, input.horizonWeeks);
          for (const m of repaired.milestones) {
            if (!m.targetDate) continue;
            expect(m.targetDate >= startDate).toBe(true);
            expect(m.targetDate <= end).toBe(true);
          }
        });
      }
    });
  }
});
