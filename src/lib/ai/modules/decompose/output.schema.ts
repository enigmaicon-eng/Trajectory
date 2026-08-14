import { z } from "zod";

// tempId is the model's own local reference (e.g. "m1", "m1p1") used to wire
// up project->milestone parentage and dependency edges within one response.
// The persistence layer (server/actions) maps these to real DB uuids.
const tempId = z.string().min(1).max(24);

export const milestoneDraftSchema = z.object({
  tempId,
  title: z.string().min(1).max(160),
  summary: z.string().max(500).nullable(),
  verification: z.string().min(1).max(400),
  targetDate: z.string().date().nullable(),
  sequence: z.number().int().min(0),
});

export const projectDraftSchema = z.object({
  tempId,
  milestoneTempId: tempId,
  title: z.string().min(1).max(160),
  summary: z.string().max(500).nullable(),
  verification: z.string().min(1).max(400),
  estimatedMinutes: z.number().int().min(1).max(100_000),
  sequence: z.number().int().min(0),
});

export const dependencyDraftSchema = z.object({
  fromTempId: tempId,
  toTempId: tempId,
  type: z.enum(["blocks", "informs"]),
  rationale: z.string().max(300).nullable(),
});

export const decomposeOutputSchema = z.object({
  milestones: z.array(milestoneDraftSchema).min(3).max(5),
  projects: z.array(projectDraftSchema).min(1).max(20),
  dependencies: z.array(dependencyDraftSchema).max(60),
});

export type MilestoneDraft = z.infer<typeof milestoneDraftSchema>;
export type ProjectDraft = z.infer<typeof projectDraftSchema>;
export type DependencyDraft = z.infer<typeof dependencyDraftSchema>;
export type DecomposeOutput = z.infer<typeof decomposeOutputSchema>;
