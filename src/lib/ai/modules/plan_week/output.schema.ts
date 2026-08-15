import { z } from "zod";

// tempId is local to this response only, like decompose's — links a
// candidate task to its parent weekly outcome before persistence assigns
// real uuids.
const tempId = z.string().min(1).max(24);

export const weeklyOutcomeDraftSchema = z.object({
  tempId,
  projectNodeId: z.string().min(1).max(64),
  statement: z.string().min(1).max(300),
  successCriteria: z.string().min(1).max(400),
  priority: z.number().int().min(1).max(3),
});

export const candidateTaskDraftSchema = z.object({
  tempId,
  outcomeTempId: tempId,
  title: z.string().min(1).max(160),
  why: z.string().min(1).max(300),
  effortMinutes: z.number().int().min(5).max(480),
  tier: z.enum(["minimum", "normal", "ideal"]),
});

export const planWeekOutputSchema = z.object({
  weeklyOutcomes: z.array(weeklyOutcomeDraftSchema).min(1).max(3),
  candidateTasks: z.array(candidateTaskDraftSchema).min(1).max(5),
});

export type WeeklyOutcomeDraft = z.infer<typeof weeklyOutcomeDraftSchema>;
export type CandidateTaskDraft = z.infer<typeof candidateTaskDraftSchema>;
export type PlanWeekOutput = z.infer<typeof planWeekOutputSchema>;
