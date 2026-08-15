import type { ReplanInput } from "./input.schema";

const SYSTEM = `You diagnose why a goal's plan is off from reality and propose a typed patch — never a full plan rewrite.

Rules:
- "diagnosis" is one honest paragraph: what's actually happening, grounded in the given signals and trigger, not generic encouragement.
- Every op needs a "reason" — one line connecting it to the diagnosis.
- Only use these op kinds: shift_milestone (nodeId, newTargetDate), rescope_milestone (nodeId, newTitle, newVerification), drop_project (nodeId), add_dependency (fromNodeId, toNodeId), remove_dependency (fromNodeId, toNodeId), adjust_capacity (idealMinutes, normalMinutes, minimumMinutes, daysPerWeek), extend_horizon (newTargetDate), narrow_outcome (newOutcomeStatement). Only set the fields relevant to the op you're proposing; leave the rest null.
- Reference only the milestone/node ids given to you — never invent one.
- For low_execution: prefer shift_milestone / narrow_outcome / drop_project over silently repeating an unachieved ambition.
- For capacity_changed: prefer adjust_capacity to match the new reality.
- For ahead_of_schedule: prefer shift_milestone (pull earlier) or extend nothing — surface the opportunity, don't manufacture busywork.
- Propose 1-4 ops, not more than needed. List every real trade-off in "tradeoffs" — what gets harder or slower as a result. Never hide a cost.
- No motivational language, no exclamation marks.`;

export function buildReplanPrompt(input: ReplanInput) {
  const milestonesBlock = input.milestones
    .map(
      (m) =>
        `- id=${m.id} :: ${m.title} (target ${m.targetDate ?? "none"}, risk=${m.risk}${m.onCriticalPath ? ", critical-path" : ""})`,
    )
    .join("\n");

  return {
    system: SYSTEM,
    prompt: `Outcome: ${input.outcomeStatement}
Domain: ${input.domain}

Trigger: ${input.trigger} — ${input.triggerDetail}

Signals: momentum=${input.signals.momentum ?? "unknown"}, executionRate=${input.signals.executionRate ?? "unknown"}, planConfidence=${input.signals.planConfidence.toFixed(2)}, riskLevel=${input.signals.riskLevel}

Capacity: ideal ${input.capacity.idealMinutes}min/day, normal ${input.capacity.normalMinutes}min/day, minimum ${input.capacity.minimumMinutes}min/day, ${input.capacity.daysPerWeek} days/week.

Milestones:
${milestonesBlock}

Diagnose and propose a patch.`,
  };
}
