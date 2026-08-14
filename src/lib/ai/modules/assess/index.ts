import type { ModuleDefinition, RunContext } from "../../run";
import { runModule } from "../../run";
import { assessInputSchema, type AssessInput } from "./input.schema";
import { assessOutputSchema, type AssessOutput } from "./output.schema";
import { buildAssessPrompt } from "./prompt.v1";

const assessModule: ModuleDefinition<AssessInput, AssessOutput> = {
  name: "assess",
  moduleClass: "light",
  inputSchema: assessInputSchema,
  outputSchema: assessOutputSchema,
  schemaName: "AssessOutput",
  buildPrompt: buildAssessPrompt,
  applyInvariants: (output) => {
    // AC-2.5: an unrealistic verdict must always carry a concrete alternative.
    if (output.verdict === "unrealistic_as_stated" && !output.alternative) {
      throw new Error("unrealistic_as_stated verdict is missing a required alternative");
    }
    return output;
  },
};

export async function runAssess(input: AssessInput, ctx: RunContext): Promise<AssessOutput> {
  return runModule(assessModule, input, ctx);
}
