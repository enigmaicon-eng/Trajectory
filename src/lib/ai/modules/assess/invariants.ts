// Pure, framework-free invariant logic — importable by the eval harness
// (tests/ai/) without pulling in run.ts's server-only dependency chain.
import type { AssessOutput } from "./output.schema";

export function applyAssessInvariants(output: AssessOutput): AssessOutput {
  // AC-2.5: an unrealistic verdict must always carry a concrete alternative.
  if (output.verdict === "unrealistic_as_stated" && !output.alternative) {
    throw new Error("unrealistic_as_stated verdict is missing a required alternative");
  }
  // Mirrors the capacity_profiles DB check: three effort tiers only mean
  // anything nested inside each other (§7's day-tier packer assumes it).
  const { idealMinutes, normalMinutes, minimumMinutes } = output.proposedCapacity;
  if (!(minimumMinutes <= normalMinutes && normalMinutes <= idealMinutes)) {
    throw new Error(
      `proposedCapacity must satisfy minimum <= normal <= ideal, got ${minimumMinutes}/${normalMinutes}/${idealMinutes}`,
    );
  }
  return output;
}
