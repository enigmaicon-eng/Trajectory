import type { DecomposeInput } from "./input.schema";

const SYSTEM = `You break an accepted goal into a dependency-aware execution graph: milestones (outcome checkpoints) and the projects (bodies of work) that produce them.

Rules:
- Produce 3-5 milestones. Each milestone needs at least 1 and at most 4 projects.
- Every milestone and project needs a "verification" string: a concrete, checkable way to know it is genuinely done (not "worked on X" but "X is published/passed/deployed/measured"). If you cannot write one, the node is too vague — sharpen it.
- Assign each project a tempId (e.g. "m1p1") and its parent milestone's tempId in milestoneTempId. Assign each milestone a tempId (e.g. "m1"). tempIds are local to this response only.
- estimatedMinutes on a project is total focused effort to complete it, grounded in the stated capacity — do not lowball or pad it to hit a number.
- Add "blocks" dependency edges (fromTempId blocks toTempId — i.e. fromTempId must complete before toTempId can start) wherever real sequencing exists (e.g. a foundation project before the project that builds on it). At least one non-trivial blocks edge is expected unless the milestones are genuinely fully parallel. Use "informs" for soft, non-blocking relationships. Never create a dependency from a node to itself, and never create a chain that could loop back on itself.
- No motivational language, no exclamation marks, no "you've got this."
- Prefer high-leverage, evidence-producing work over consumption ("read about X").
- Do not invent milestones that don't serve the stated outcome just to hit the count floor — if genuinely only 3 make sense, use 3.`;

export function buildDecomposePrompt(input: DecomposeInput) {
  const budgetMinutes = input.horizonWeeks * input.capacity.idealMinutes * input.capacity.daysPerWeek;
  const constraintsBlock =
    input.constraints.length > 0
      ? input.constraints
          .map((c) => `- [${c.kind}${c.isHard ? ", hard" : ""}] ${c.label}`)
          .join("\n")
      : "(none stated)";

  return {
    system: SYSTEM,
    prompt: `Outcome: ${input.outcomeStatement}
Domain: ${input.domain}
Target date: ${input.targetDate ?? "not specified"}
Horizon: ${input.horizonWeeks} weeks

Feasibility verdict: ${input.feasibilityVerdict} — ${input.feasibilityRationale}

Capacity: ideal day ${input.capacity.idealMinutes} min, normal day ${input.capacity.normalMinutes} min, minimum-viable day ${input.capacity.minimumMinutes} min, ${input.capacity.daysPerWeek} days/week.
Total available effort across the horizon (upper bound at the ideal-day pace): ~${budgetMinutes} minutes. Keep total project effort within this budget — do not exceed it by more than a small margin.

Constraints:
${constraintsBlock}

Decompose this goal into milestones, projects, and dependencies.`,
  };
}
