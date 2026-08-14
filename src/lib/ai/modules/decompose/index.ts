import type { ModuleDefinition, RunContext } from "../../run";
import { runModule } from "../../run";
import { decomposeInputSchema, type DecomposeInput } from "./input.schema";
import { decomposeOutputSchema, type DecomposeOutput } from "./output.schema";
import { buildDecomposePrompt } from "./prompt.v1";
import { applyDecomposeInvariants } from "@/lib/domain/invariants";

const decomposeModule: ModuleDefinition<DecomposeInput, DecomposeOutput> = {
  name: "decompose",
  moduleClass: "heavy",
  inputSchema: decomposeInputSchema,
  outputSchema: decomposeOutputSchema,
  schemaName: "DecomposeOutput",
  buildPrompt: buildDecomposePrompt,
  applyInvariants: (output, input) =>
    applyDecomposeInvariants(output, {
      horizonWeeks: input.horizonWeeks,
      idealMinutes: input.capacity.idealMinutes,
      daysPerWeek: input.capacity.daysPerWeek,
    }),
};

export async function runDecompose(input: DecomposeInput, ctx: RunContext): Promise<DecomposeOutput> {
  return runModule(decomposeModule, input, ctx);
}
