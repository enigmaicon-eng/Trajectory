import { z } from "zod";

// §5.3 Gemini structured-output note: no top-level discriminated unions —
// express PlanOp as a flat object with an enum discriminator ("op") plus
// nullable per-variant fields, not a real union. applyPlanPatch() (server
// action) reads only the fields relevant to each op's discriminator.
//
// v1 supports 8 of the 11 PlanOp kinds from the architecture doc. Cut:
// insert_project (needs a decompose-like node-creation flow), reorder
// (low-value relative to the others), rebuild_weeks (redundant — every
// accepted patch regenerates the plan regardless, see applyPlanPatch).
export const planOpKindSchema = z.enum([
  "shift_milestone",
  "rescope_milestone",
  "drop_project",
  "add_dependency",
  "remove_dependency",
  "adjust_capacity",
  "extend_horizon",
  "narrow_outcome",
]);

export const planOpSchema = z.object({
  op: planOpKindSchema,
  reason: z.string().min(1).max(300),
  nodeId: z.string().max(64).nullable(), // shift_milestone, rescope_milestone, drop_project
  newTargetDate: z.string().date().nullable(), // shift_milestone, extend_horizon
  newTitle: z.string().max(160).nullable(), // rescope_milestone
  newVerification: z.string().max(400).nullable(), // rescope_milestone
  fromNodeId: z.string().max(64).nullable(), // add_dependency, remove_dependency
  toNodeId: z.string().max(64).nullable(), // add_dependency, remove_dependency
  idealMinutes: z.number().int().min(5).max(960).nullable(), // adjust_capacity
  normalMinutes: z.number().int().min(5).max(960).nullable(), // adjust_capacity
  minimumMinutes: z.number().int().min(1).max(960).nullable(), // adjust_capacity
  daysPerWeek: z.number().int().min(1).max(7).nullable(), // adjust_capacity
  newOutcomeStatement: z.string().max(500).nullable(), // narrow_outcome
});

export const replanOutputSchema = z.object({
  diagnosis: z.string().min(1).max(600),
  confidence: z.number().min(0).max(1),
  ops: z.array(planOpSchema).min(1).max(8),
  tradeoffs: z.array(z.string().max(300)).max(6),
});

export type PlanOp = z.infer<typeof planOpSchema>;
export type ReplanOutput = z.infer<typeof replanOutputSchema>;
