import { z } from "zod";

export const reflectInputSchema = z.object({
  outcomeStatement: z.string().min(1).max(500),
  domain: z.string(),
  weekExecution: z.object({
    plannedMinutes: z.number().int().min(0),
    completedMinutes: z.number().int().min(0),
    tasksDone: z.number().int().min(0),
    tasksTotal: z.number().int().min(0),
  }),
  userReflection: z.object({
    whatWorked: z.string().max(1000).nullable(),
    whatDidnt: z.string().max(1000).nullable(),
    blockers: z.string().max(1000).nullable(),
  }),
});

export type ReflectInput = z.infer<typeof reflectInputSchema>;
