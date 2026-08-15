// Domain invariants for AI-proposed `plan_week` output (§7.4, AC-4). Sibling
// to invariants.ts (which is decompose-shaped); this one operates on
// weekly-outcome/candidate-task drafts. Framework-free and I/O-free.
//
// What zod already enforces on the output schema: non-empty `why`, positive
// `effortMinutes`, array length caps. What only this module can check: that
// every outcome/task references a project that actually exists in the
// persisted graph, and that at least one outcome survives.

export interface WeeklyOutcomeDraftLike {
  tempId: string;
  priority: number;
  projectNodeId: string;
}

export interface CandidateTaskDraftLike {
  tempId: string;
  outcomeTempId: string;
  effortMinutes: number;
  why: string;
}

export interface PlanWeekDraft<O extends WeeklyOutcomeDraftLike, T extends CandidateTaskDraftLike> {
  weeklyOutcomes: O[];
  candidateTasks: T[];
}

export class UnrepairablePlanWeekError extends Error {}

/**
 * Repairs `plan_week` output deterministically, in order:
 *  1. drop outcomes referencing a projectNodeId outside the eligible set
 *     (the model must ground outcomes in real, ready projects)
 *  2. throw if that leaves zero outcomes — no amount of trimming fixes it
 *  3. cap outcomes at `maxOutcomes`, keeping lowest-priority-number (highest
 *     leverage) first
 *  4. drop tasks with a dangling outcomeTempId or an empty `why`
 *  5. cap total tasks at `maxTasks`, preserving outcome-priority order
 */
export function applyPlanWeekInvariants<O extends WeeklyOutcomeDraftLike, T extends CandidateTaskDraftLike>(
  draft: PlanWeekDraft<O, T>,
  eligibleProjectNodeIds: Set<string>,
  maxOutcomes = 3,
  maxTasks = 5,
): PlanWeekDraft<O, T> {
  const validOutcomes = draft.weeklyOutcomes.filter((o) => eligibleProjectNodeIds.has(o.projectNodeId));
  if (validOutcomes.length === 0) {
    throw new UnrepairablePlanWeekError("plan_week: no weekly outcome references an eligible project");
  }

  const outcomes = [...validOutcomes].sort((a, b) => a.priority - b.priority).slice(0, maxOutcomes);
  const outcomeIds = new Set(outcomes.map((o) => o.tempId));

  const tasks = draft.candidateTasks
    .filter((t) => outcomeIds.has(t.outcomeTempId) && t.why.trim().length > 0)
    .slice(0, maxTasks);

  return { weeklyOutcomes: outcomes, candidateTasks: tasks };
}
