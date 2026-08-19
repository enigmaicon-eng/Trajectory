import type { ModuleDefinition, RunContext } from "../../run";
import { runModule } from "../../run";
import { replanInputSchema, type ReplanInput } from "./input.schema";
import { replanOutputSchema, type ReplanOutput } from "./output.schema";
import { buildReplanPrompt } from "./prompt.v1";
import { applyReplanInvariants } from "./invariants";

export { applyReplanInvariants } from "./invariants";

const replanModule: ModuleDefinition<ReplanInput, ReplanOutput> = {
  name: "replan",
  moduleClass: "heavy",
  inputSchema: replanInputSchema,
  outputSchema: replanOutputSchema,
  schemaName: "ReplanOutput",
  buildPrompt: buildReplanPrompt,
  applyInvariants: (output, input) =>
    applyReplanInvariants(output, new Set(input.milestones.map((m) => m.id))),
};

export async function runReplan(input: ReplanInput, ctx: RunContext): Promise<ReplanOutput> {
  return runModule(replanModule, input, ctx);
}
