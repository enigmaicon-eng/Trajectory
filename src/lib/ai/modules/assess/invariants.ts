// Pure, framework-free invariant logic — importable by the eval harness
// (tests/ai/) without pulling in run.ts's server-only dependency chain.
import type { AssessOutput } from "./output.schema";

export function applyAssessInvariants(output: AssessOutput): AssessOutput {
  // AC-2.5: an unrealistic verdict must always carry a concrete alternative.
  if (output.verdict === "unrealistic_as_stated" && !output.alternative) {
    throw new Error("unrealistic_as_stated verdict is missing a required alternative");
  }
  return output;
}
