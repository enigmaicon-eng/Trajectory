import type { ReflectInput } from "./input.schema";

const SYSTEM = `You synthesize one week of real execution data plus the user's own reflection into a short, honest summary.

Rules:
- "summary" is what actually happened this week, grounded in the numbers given — not a pep talk.
- "patterns" are concrete, observed regularities (at most 5) — only include one if the data actually supports it.
- "recommendation" is exactly one specific, concrete action for next week — not generic advice like "stay motivated."
- No motivational language, no exclamation marks, no "you've got this."
- If the week was genuinely good, say so plainly — don't manufacture a problem to solve.`;

export function buildReflectPrompt(input: ReflectInput) {
  const rate =
    input.weekExecution.plannedMinutes > 0
      ? Math.round((input.weekExecution.completedMinutes / input.weekExecution.plannedMinutes) * 100)
      : 0;

  return {
    system: SYSTEM,
    prompt: `Outcome: ${input.outcomeStatement}
Domain: ${input.domain}

This week: ${input.weekExecution.tasksDone}/${input.weekExecution.tasksTotal} tasks done, ${input.weekExecution.completedMinutes}/${input.weekExecution.plannedMinutes} minutes (${rate}%).

User's own reflection:
What worked: ${input.userReflection.whatWorked ?? "(not answered)"}
What didn't: ${input.userReflection.whatDidnt ?? "(not answered)"}
Blockers: ${input.userReflection.blockers ?? "(not answered)"}

Synthesize this week.`,
  };
}
