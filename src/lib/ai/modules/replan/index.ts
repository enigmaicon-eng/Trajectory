import type { ModuleDefinition, RunContext } from "../../run";
import { runModule } from "../../run";
import { replanInputSchema, type ReplanInput } from "./input.schema";
import { replanOutputSchema, type ReplanOutput } from "./output.schema";
import { buildReplanPrompt } from "./prompt.v1";

const replanModule: ModuleDefinition<ReplanInput, ReplanOutput> = {
  name: "replan",
  moduleClass: "heavy",
  inputSchema: replanInputSchema,
  outputSchema: replanOutputSchema,
  schemaName: "ReplanOutput",
  buildPrompt: buildReplanPrompt,
  applyInvariants: (output, input) => {
    const validIds = new Set(input.milestones.map((m) => m.id));
    // Drop ops referencing an unknown node id — the invariant zod can't
    // express (it doesn't know which ids are real). Ops with no node
    // reference (adjust_capacity, extend_horizon, narrow_outcome) always pass.
    const ops = output.ops.filter((op) => {
      const referenced = [op.nodeId, op.fromNodeId, op.toNodeId].filter((id): id is string => id !== null);
      return referenced.every((id) => validIds.has(id));
    });
    if (ops.length === 0) {
      throw new Error("replan: every proposed op referenced an unknown node id");
    }
    return { ...output, ops };
  },
};

export async function runReplan(input: ReplanInput, ctx: RunContext): Promise<ReplanOutput> {
  return runModule(replanModule, input, ctx);
}
