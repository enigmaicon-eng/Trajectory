import { z } from "zod";

export const assessInputSchema = z.object({
  rawInput: z.string().min(1).max(2000),
  outcomeStatement: z.string().min(1).max(500),
  domain: z.string(),
  targetDate: z.string().nullable(),
  horizonWeeks: z.number().int().min(1).max(260).nullable(),
  // questionId -> free-text answer; missing/empty entries mean the user skipped
  answers: z.record(z.string(), z.string()),
});

export type AssessInput = z.infer<typeof assessInputSchema>;
