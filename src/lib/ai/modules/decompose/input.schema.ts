import { z } from "zod";

export const decomposeConstraintSchema = z.object({
  kind: z.enum(["time", "money", "hard_date", "commitment", "preference", "prohibition"]),
  label: z.string().min(1).max(200),
  isHard: z.boolean(),
});

export const decomposeCapacitySchema = z.object({
  idealMinutes: z.number().int().min(5).max(960),
  normalMinutes: z.number().int().min(5).max(960),
  minimumMinutes: z.number().int().min(1).max(960),
  daysPerWeek: z.number().int().min(1).max(7),
});

export const decomposeInputSchema = z.object({
  outcomeStatement: z.string().min(1).max(500),
  domain: z.string(),
  targetDate: z.string().date().nullable(),
  horizonWeeks: z.number().int().min(1).max(260),
  feasibilityVerdict: z.enum(["realistic", "ambitious_but_possible", "unrealistic_as_stated"]),
  feasibilityRationale: z.string(),
  constraints: z.array(decomposeConstraintSchema).max(20),
  capacity: decomposeCapacitySchema,
});

export type DecomposeInput = z.infer<typeof decomposeInputSchema>;
