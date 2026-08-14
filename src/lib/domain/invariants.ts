// Domain invariants for AI-proposed decomposition output (§7.4, AC-3).
// Framework-free and I/O-free like graph.ts — operates on structural shapes
// (not the AI module's zod-inferred types directly) so this stays reusable
// and independently unit-testable.
//
// Non-empty verification and positive estimatedMinutes are already enforced
// structurally by the decompose output zod schema (min-length / min-value
// constraints) before this module ever runs — what zod *cannot* express are
// the cross-array invariants below: parent existence, per-milestone project
// counts, graph acyclicity, and an effort budget that depends on input data
// (capacity/horizon) outside the output shape.

import { breakCycles } from "./graph";
import type { DependencyType, GraphEdge, GraphNode } from "./types";

export interface MilestoneDraftLike {
  tempId: string;
  sequence: number;
}

export interface ProjectDraftLike {
  tempId: string;
  milestoneTempId: string;
  estimatedMinutes: number;
  sequence: number;
}

export interface DependencyDraftLike {
  fromTempId: string;
  toTempId: string;
  type: DependencyType;
}

export interface DecomposeDraft<
  M extends MilestoneDraftLike,
  P extends ProjectDraftLike,
  D extends DependencyDraftLike,
> {
  milestones: M[];
  projects: P[];
  dependencies: D[];
}

export interface CapacityBudget {
  horizonWeeks: number;
  idealMinutes: number;
  daysPerWeek: number;
}

export const EFFORT_BUDGET_TOLERANCE = 0.25;

export function effortBudgetMinutes(budget: CapacityBudget): number {
  return budget.horizonWeeks * budget.idealMinutes * budget.daysPerWeek;
}

export class UnrepairableDecomposeError extends Error {}

/**
 * Repairs AI decomposition output deterministically wherever possible, in
 * order:
 *  1. drop projects whose milestoneTempId doesn't reference a real milestone
 *  2. drop milestones left with zero projects; throws if that leaves <3
 *     (AC-3.7 — a violation no amount of trimming can fix)
 *  3. cap projects per milestone at 4, keeping the lowest-sequence ones
 *  4. drop dependency edges (and self-loops) referencing dropped/unknown nodes
 *  5. break any `blocks` cycle (graph.ts breakCycles — AC-3.8)
 *  6. if total project effort falls outside ±25% of
 *     horizonWeeks * idealMinutes * daysPerWeek, scale every project's
 *     estimatedMinutes proportionally onto the budget (AC-3.10)
 */
export function applyDecomposeInvariants<
  M extends MilestoneDraftLike,
  P extends ProjectDraftLike,
  D extends DependencyDraftLike,
>(draft: DecomposeDraft<M, P, D>, budget: CapacityBudget): DecomposeDraft<M, P, D> {
  const milestoneIds = new Set(draft.milestones.map((m) => m.tempId));

  const projectsByMilestone = new Map<string, P[]>();
  for (const p of draft.projects) {
    if (!milestoneIds.has(p.milestoneTempId)) continue; // dangling parent, drop
    const list = projectsByMilestone.get(p.milestoneTempId) ?? [];
    list.push(p);
    projectsByMilestone.set(p.milestoneTempId, list);
  }

  const milestones = draft.milestones.filter(
    (m) => (projectsByMilestone.get(m.tempId)?.length ?? 0) > 0,
  );
  if (milestones.length < 3) {
    throw new UnrepairableDecomposeError(
      `decompose: only ${milestones.length} milestone(s) have >=1 valid project (need >=3)`,
    );
  }

  const projects = milestones.flatMap((m) => {
    const list = [...(projectsByMilestone.get(m.tempId) ?? [])].sort((a, b) => a.sequence - b.sequence);
    return list.slice(0, 4); // cap 4 projects/milestone (AC-3.7), keep earliest-sequence
  });

  const validNodeIds = new Set<string>([...milestones.map((m) => m.tempId), ...projects.map((p) => p.tempId)]);
  const validDependencies = draft.dependencies.filter(
    (d) => validNodeIds.has(d.fromTempId) && validNodeIds.has(d.toTempId) && d.fromTempId !== d.toTempId,
  );

  const graphNodes: GraphNode[] = [
    ...milestones.map((m) => ({ id: m.tempId, kind: "milestone" as const, parentId: null, estimatedMinutes: null })),
    ...projects.map((p) => ({
      id: p.tempId,
      kind: "project" as const,
      parentId: p.milestoneTempId,
      estimatedMinutes: p.estimatedMinutes,
    })),
  ];
  const graphEdges: GraphEdge[] = validDependencies.map((d) => ({
    fromNodeId: d.fromTempId,
    toNodeId: d.toTempId,
    type: d.type,
  }));
  // graphEdges[i] shares object identity with validDependencies[i];
  // breakCycles() preserves identity for survivors, recovering the original
  // (typed) dependency draft for each surviving edge.
  const edgeToDep = new Map<GraphEdge, D>();
  validDependencies.forEach((d, i) => edgeToDep.set(graphEdges[i], d));
  const { edges: survivingEdges } = breakCycles(graphNodes, graphEdges);
  const dependencies = survivingEdges.map((e) => edgeToDep.get(e) as D);

  const budgetMinutes = effortBudgetMinutes(budget);
  const totalMinutes = projects.reduce((sum, p) => sum + p.estimatedMinutes, 0);
  const lower = budgetMinutes * (1 - EFFORT_BUDGET_TOLERANCE);
  const upper = budgetMinutes * (1 + EFFORT_BUDGET_TOLERANCE);

  let finalProjects = projects;
  if (budgetMinutes > 0 && totalMinutes > 0 && (totalMinutes < lower || totalMinutes > upper)) {
    const scale = budgetMinutes / totalMinutes;
    finalProjects = projects.map((p) => ({
      ...p,
      estimatedMinutes: Math.max(1, Math.round(p.estimatedMinutes * scale)),
    }));
  }

  return { milestones, projects: finalProjects, dependencies };
}
