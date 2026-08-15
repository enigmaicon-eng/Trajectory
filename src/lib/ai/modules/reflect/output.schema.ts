import { z } from "zod";

export const reflectOutputSchema = z.object({
  summary: z.string().min(1).max(500),
  patterns: z.array(z.string().max(200)).max(5),
  recommendation: z.string().min(1).max(400),
  confidence: z.number().min(0).max(1),
});

export type ReflectOutput = z.infer<typeof reflectOutputSchema>;
