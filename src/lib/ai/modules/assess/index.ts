import type { ModuleDefinition, RunContext } from "../../run";
import { runModule } from "../../run";
import { assessInputSchema, type AssessInput } from "./input.schema";
import { assessOutputSchema, type AssessOutput } from "./output.schema";
import { buildAssessPrompt } from "./prompt.v1";
import { applyAssessInvariants } from "./invariants";

export { applyAssessInvariants } from "./invariants";

const assessModule: ModuleDefinition<AssessInput, AssessOutput> = {
  name: "assess",
  moduleClass: "light",
  inputSchema: assessInputSchema,
  outputSchema: assessOutputSchema,
  schemaName: "AssessOutput",
  buildPrompt: buildAssessPrompt,
  applyInvariants: applyAssessInvariants,
};

export async function runAssess(input: AssessInput, ctx: RunContext): Promise<AssessOutput> {
  return runModule(assessModule, input, ctx);
}
