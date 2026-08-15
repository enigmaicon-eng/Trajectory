// Capacity-aware task placement (§2.2, §5.1: "the engine decides"). The AI
// proposes candidate tasks with an effort estimate; this pure engine is what
// actually fits them onto real calendar days within a day's minute budget.
// No I/O, no framework imports — unit-testable like graph.ts/capacity.ts.

import type { ISODate } from "./dates";

export interface CandidateTaskLike {
  tempId: string;
  title: string;
  why: string;
  effortMinutes: number;
  tier: "minimum" | "normal" | "ideal";
  outcomeTempId: string;
  projectNodeId: string | null;
}

export interface ScheduledTask extends CandidateTaskLike {
  scheduledFor: ISODate;
  sequence: number;
}

export interface ScheduleResult {
  scheduled: ScheduledTask[];
  /** Tasks that didn't fit anywhere, or were cut by the maxTasks cap — lowest-priority (last) input tasks first. */
  dropped: CandidateTaskLike[];
}

/**
 * Greedily places `tasks` (assumed pre-sorted highest-priority first) onto
 * `availableDays`, each with `dailyCapacityMinutes` of budget. Each task goes
 * to whichever fitting day currently has the most remaining capacity (spreads
 * load rather than cramming the first day); a task that fits nowhere, or
 * falls past `maxTasks`, is dropped rather than silently overflowing a day's
 * or the week's budget — matching §5.7's "never propose a week that exceeds
 * the ideal-day budget."
 */
export function scheduleTasks(
  tasks: CandidateTaskLike[],
  availableDays: ISODate[],
  dailyCapacityMinutes: number,
  maxTasks = 5,
): ScheduleResult {
  const capped = tasks.slice(0, maxTasks);
  const dropped: CandidateTaskLike[] = tasks.slice(maxTasks);

  const remaining = new Map<ISODate, number>();
  for (const d of availableDays) remaining.set(d, dailyCapacityMinutes);

  const scheduled: ScheduledTask[] = [];
  let sequence = 0;

  for (const task of capped) {
    let bestDay: ISODate | null = null;
    let bestRemaining = -Infinity;
    for (const d of availableDays) {
      const r = remaining.get(d) ?? 0;
      if (r >= task.effortMinutes && r > bestRemaining) {
        bestRemaining = r;
        bestDay = d;
      }
    }
    if (bestDay === null) {
      dropped.push(task);
      continue;
    }
    remaining.set(bestDay, (remaining.get(bestDay) ?? 0) - task.effortMinutes);
    scheduled.push({ ...task, scheduledFor: bestDay, sequence: sequence++ });
  }

  scheduled.sort((a, b) =>
    a.scheduledFor === b.scheduledFor ? a.sequence - b.sequence : a.scheduledFor < b.scheduledFor ? -1 : 1,
  );
  return { scheduled, dropped };
}

export function totalMinutes(tasks: { effortMinutes: number }[]): number {
  return tasks.reduce((sum, t) => sum + t.effortMinutes, 0);
}
