import type { ModuleDefinition, RunContext } from "../../run";
import { runModule } from "../../run";
import { reflectInputSchema, type ReflectInput } from "./input.schema";
import { reflectOutputSchema, type ReflectOutput } from "./output.schema";
import { buildReflectPrompt } from "./prompt.v1";

const reflectModule: ModuleDefinition<ReflectInput, ReflectOutput> = {
  name: "reflect",
  moduleClass: "light",
  inputSchema: reflectInputSchema,
  outputSchema: reflectOutputSchema,
  schemaName: "ReflectOutput",
  buildPrompt: buildReflectPrompt,
};

export async function runReflect(input: ReflectInput, ctx: RunContext): Promise<ReflectOutput> {
  return runModule(reflectModule, input, ctx);
}
