import type { ModuleDefinition, RunContext } from "../../run";
import { runModule } from "../../run";
import { clarifyInputSchema, type ClarifyInput } from "./input.schema";
import { clarifyOutputSchema, type ClarifyOutput } from "./output.schema";
import { buildClarifyPrompt } from "./prompt.v1";
import { applyClarifyInvariants } from "./invariants";

export { applyClarifyInvariants } from "./invariants";

const clarifyModule: ModuleDefinition<ClarifyInput, ClarifyOutput> = {
  name: "clarify",
  moduleClass: "light",
  inputSchema: clarifyInputSchema,
  outputSchema: clarifyOutputSchema,
  schemaName: "ClarifyOutput",
  buildPrompt: buildClarifyPrompt,
  applyInvariants: applyClarifyInvariants,
};

export async function runClarify(input: ClarifyInput, ctx: RunContext): Promise<ClarifyOutput> {
  return runModule(clarifyModule, input, ctx);
}
