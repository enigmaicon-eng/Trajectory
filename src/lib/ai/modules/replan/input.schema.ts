import { z } from "zod";

export const replanMilestoneSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string(),
  targetDate: z.string().date().nullable(),
  risk: z.enum(["on_track", "at_risk", "off_track", "unknown"]),
  onCriticalPath: z.boolean(),
});

export const replanInputSchema = z.object({
  outcomeStatement: z.string().min(1).max(500),
  domain: z.string(),
  trigger: z.enum([
    "user_requested",
    "low_execution",
    "milestone_off_track",
    "capacity_changed",
    "ahead_of_schedule",
    "missed_checkins",
    "priority_change",
    "dependency_change",
  ]),
  triggerDetail: z.string().max(500),
  milestones: z.array(replanMilestoneSchema).min(1).max(10),
  capacity: z.object({
    idealMinutes: z.number().int().min(5).max(960),
    normalMinutes: z.number().int().min(5).max(960),
    minimumMinutes: z.number().int().min(1).max(960),
    daysPerWeek: z.number().int().min(1).max(7),
  }),
  signals: z.object({
    momentum: z.number().nullable(),
    executionRate: z.number().nullable(),
    planConfidence: z.number(),
    riskLevel: z.enum(["on_track", "at_risk", "off_track", "unknown"]),
  }),
});

export type ReplanInput = z.infer<typeof replanInputSchema>;
