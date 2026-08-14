import { z } from "zod";

export const aiQuestionSchema = z.object({
  id: z.string().min(1).max(40),
  prompt: z.string().min(1).max(200),
});

export type AIQuestion = z.infer<typeof aiQuestionSchema>;

export const clarifyOutputSchema = z.object({
  title: z.string().min(1).max(120),
  outcomeStatement: z.string().min(1).max(500),
  domain: z.enum([
    "career",
    "skill",
    "business",
    "fitness",
    "finance",
    "project",
    "other",
  ]),
  targetDate: z.string().date().nullable(),
  horizonWeeks: z.number().int().min(1).max(260).nullable(),
  questions: z.array(aiQuestionSchema).max(4),
});

export type ClarifyOutput = z.infer<typeof clarifyOutputSchema>;
