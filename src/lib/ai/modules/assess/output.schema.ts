import { z } from "zod";

export const feasibilityVerdictSchema = z.enum([
  "realistic",
  "ambitious_but_possible",
  "unrealistic_as_stated",
]);

export const assessOutputSchema = z.object({
  verdict: feasibilityVerdictSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(1000),
  keyRisks: z
    .array(
      z.object({
        risk: z.string(),
        severity: z.enum(["low", "medium", "high"]),
        mitigation: z.string(),
      }),
    )
    .max(6),
  comparableBasis: z.string().nullable(),
  alternative: z
    .object({
      outcomeStatement: z.string(),
      horizonWeeks: z.number().int().min(1).max(260),
      whyStronger: z.string(),
    })
    .nullable(),
});

export type AssessOutput = z.infer<typeof assessOutputSchema>;
