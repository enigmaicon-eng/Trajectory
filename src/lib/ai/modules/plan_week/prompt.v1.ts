import type { PlanWeekInput } from "./input.schema";

const SYSTEM = `You turn a slice of a goal's execution graph into one week's concrete plan: 1-3 weekly outcomes and up to 5 candidate tasks that produce them.

Rules:
- Every weeklyOutcome must reference one of the given eligible project ids in projectNodeId — never invent one.
- "statement" is the meaningful result for the week (e.g. "Publish teardown #2"), not a task list. "successCriteria" is how we'll know it happened.
- priority 1 = highest leverage; use 1-3, do not repeat unless outcomes are genuinely equal in leverage.
- Produce at most 5 candidateTasks total across all outcomes this week. Each task needs a tempId, the outcomeTempId it serves, a title, an effortMinutes grounded in the stated capacity, a tier ("minimum" | "normal" | "ideal" — which day-tier this task belongs to), and a "why" — one line connecting it to its outcome. If you cannot write a genuine why, drop the task.
- Do not exceed the stated capacity: total candidateTasks effort should fit within availableDayCount * idealMinutes.
- No motivational language, no exclamation marks, no "you've got this."
- Prefer high-leverage, evidence-producing actions over consumption ("read about X", "research Y").
- If recentExecution shows the user is behind (completedMinutes well under plannedMinutes), propose a lighter, more achievable week rather than repeating the same ambition.`;

export function buildPlanWeekPrompt(input: PlanWeekInput) {
  const budgetMinutes = input.capacity.availableDayCount * input.capacity.idealMinutes;
  const projectsBlock = input.eligibleProjects
    .map((p) => `- id=${p.id} :: ${p.title} (~${p.estimatedMinutes}min total) — verified by: ${p.verification}`)
    .join("\n");
  const executionBlock = input.recentExecution
    ? `Recent execution: planned ${input.recentExecution.plannedMinutes}min, completed ${input.recentExecution.completedMinutes}min. ${input.recentExecution.note}`
    : "Recent execution: none yet — this is the first week of the plan.";

  return {
    system: SYSTEM,
    prompt: `Outcome: ${input.outcomeStatement}
Domain: ${input.domain}
Week ${input.weekIndex + 1} of this plan (${input.weeksRemaining} week(s) remaining in the horizon).

Capacity this week: ideal day ${input.capacity.idealMinutes}min, normal day ${input.capacity.normalMinutes}min, minimum-viable day ${input.capacity.minimumMinutes}min, over ${input.capacity.availableDayCount} available day(s). Total budget: ~${budgetMinutes} minutes.

${executionBlock}

Eligible projects (ready to work on now — reference these ids exactly):
${projectsBlock}

Plan this week.`,
  };
}
