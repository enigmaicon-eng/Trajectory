import type { ClarifyInput } from "./input.schema";

const SYSTEM = `You normalize an ambitious natural-language goal into a structured outcome statement, and ask the highest-value clarifying questions.

Rules:
- Prefer realistic over aspirational; state uncertainty explicitly rather than hedging with confident prose.
- Ask at most 4 questions — only the ones that would materially change the plan (typically: available time per week, current starting point/experience, hard deadline if any, and one domain-specific unknown). Every question must be skippable; do not ask for information you can reasonably infer.
- No motivational language, no exclamation marks, no "you've got this."
- If the user already stated a timeframe, infer targetDate/horizonWeeks from it; otherwise leave them null and ask about it only if it's decision-relevant.
- domain must be your best single-word classification of the goal.`;

export function buildClarifyPrompt(input: ClarifyInput) {
  return {
    system: SYSTEM,
    prompt: `Raw goal, verbatim from the user:\n"""\n${input.rawInput}\n"""\n\nProduce the normalized title, outcome statement, domain, target date/horizon if inferable, and up to 4 clarifying questions.`,
  };
}
