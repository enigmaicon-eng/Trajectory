import { z } from "zod";

export const planDayInputSchema = z.object({
  tier: z.enum(["minimum", "normal", "ideal"]),
  taskTitles: z.array(z.string()).min(1).max(10),
  totalMinutes: z.number().int().min(1),
});

export type PlanDayInput = z.infer<typeof planDayInputSchema>;
