import { z } from "zod";

export const planWeekEligibleProjectSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string(),
  verification: z.string(),
  estimatedMinutes: z.number().int(),
});

export const planWeekCapacitySchema = z.object({
  idealMinutes: z.number().int().min(5).max(960),
  normalMinutes: z.number().int().min(5).max(960),
  minimumMinutes: z.number().int().min(1).max(960),
  availableDayCount: z.number().int().min(1).max(7),
});

export const planWeekInputSchema = z.object({
  outcomeStatement: z.string().min(1).max(500),
  domain: z.string(),
  weekIndex: z.number().int().min(0),
  weeksRemaining: z.number().int().min(1),
  eligibleProjects: z.array(planWeekEligibleProjectSchema).min(1).max(30),
  capacity: planWeekCapacitySchema,
  recentExecution: z
    .object({
      plannedMinutes: z.number().int().min(0),
      completedMinutes: z.number().int().min(0),
      note: z.string(),
    })
    .nullable(),
});

export type PlanWeekInput = z.infer<typeof planWeekInputSchema>;
