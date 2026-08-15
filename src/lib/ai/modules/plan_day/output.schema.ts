import { z } from "zod";

export const planDayOutputSchema = z.object({
  framing: z.string().min(1).max(140),
});

export type PlanDayOutput = z.infer<typeof planDayOutputSchema>;
