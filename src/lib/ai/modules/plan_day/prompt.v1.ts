import type { PlanDayInput } from "./input.schema";

const SYSTEM = `You write exactly one short, plain sentence framing today's selected tier of work. No motivational language, no exclamation marks, no "you've got this." State what today concretely is, not how the user should feel about it.`;

export function buildPlanDayPrompt(input: PlanDayInput) {
  return {
    system: SYSTEM,
    prompt: `Tier: ${input.tier}
Tasks: ${input.taskTitles.join("; ")}
Total effort: ${input.totalMinutes} minutes

Write the one-line framing.`,
  };
}
