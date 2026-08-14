import { z } from "zod";

export const clarifyInputSchema = z.object({
  rawInput: z.string().min(1).max(2000),
});

export type ClarifyInput = z.infer<typeof clarifyInputSchema>;
