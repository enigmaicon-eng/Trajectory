import { z } from "zod";

export const feasibilityVerdictSchema = z.enum([
  "realistic",
  "ambitious_but_possible",
  "unrealistic_as_stated",
]);

// §3.2 CapacityProfile: the ideal/normal/minimum-viable day, in minutes. The
// AI proposes it once, here, from the goal's domain and the user's own
// stated constraints, so a new goal's Minimum Viable Progress tiers are
// personalized from day one instead of a single hardcoded default shared by
// every goal regardless of domain (decompose.ts falls back to that default
// only when no proposal is on record).
export const proposedCapacitySchema = z.object({
  idealMinutes: z.number().int().min(5).max(960),
  normalMinutes: z.number().int().min(5).max(960),
  minimumMinutes: z.number().int().min(1).max(960),
});

export const assessOutputSchema = z.object({
  verdict: feasibilityVerdictSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(1000),
  proposedCapacity: proposedCapacitySchema,
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
