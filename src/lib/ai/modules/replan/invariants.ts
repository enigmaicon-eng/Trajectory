// Pure, framework-free invariant logic — importable by the eval harness
// (tests/ai/) without pulling in run.ts's server-only dependency chain.
import type { ReplanOutput } from "./output.schema";

export function applyReplanInvariants(output: ReplanOutput, validNodeIds: Set<string>): ReplanOutput {
  // Drop ops referencing an unknown node id — the invariant zod can't
  // express (it doesn't know which ids are real). Ops with no node
  // reference (adjust_capacity, extend_horizon, narrow_outcome) always pass.
  const ops = output.ops.filter((op) => {
    const referenced = [op.nodeId, op.fromNodeId, op.toNodeId].filter((id): id is string => id !== null);
    return referenced.every((id) => validNodeIds.has(id));
  });
  if (ops.length === 0) {
    throw new Error("replan: every proposed op referenced an unknown node id");
  }
  return { ...output, ops };
}
