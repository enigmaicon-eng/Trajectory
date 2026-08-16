// Pure, framework-free invariant logic — importable by the eval harness
// (tests/ai/) without pulling in run.ts's server-only dependency chain.
import type { ClarifyOutput } from "./output.schema";

export function applyClarifyInvariants(output: ClarifyOutput): ClarifyOutput {
  if (output.questions.length > 4) {
    return { ...output, questions: output.questions.slice(0, 4) };
  }
  return output;
}
