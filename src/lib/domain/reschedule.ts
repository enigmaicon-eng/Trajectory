// Deterministic "carry forward" computation (MVP progress: a task not done
// on its scheduled day is never silently lost, and the day it slipped is
// never overwritten). The original row is marked `deferred` by the caller —
// a status distinct from `skipped`/`dropped` precisely so history shows a
// day changed, not a task abandoned (§11.1: the plan takes responsibility,
// not the user). This module computes the fields of the fresh instance that
// lands on the new day; the caller (a server action) owns id generation and
// the two writes. No I/O, no framework imports — unit-testable like the rest
// of lib/domain.

export interface CarriableTaskLike {
  title: string;
  why: string | null;
  effortMinutes: number;
  tier: "minimum" | "normal" | "ideal";
  sequence: number;
}

export interface RescheduledTaskFields extends CarriableTaskLike {
  scheduledFor: string;
  status: "pending";
  isUserAdded: false;
}

/**
 * The new day's task is a plain re-instantiation of the original — same
 * title, why, effort, and tier, so it packs into the target day's tiers
 * exactly as any other task would (§7). Sequence is preserved rather than
 * reset so a task carried alongside same-day siblings keeps its relative
 * order.
 */
export function rescheduleTask(task: CarriableTaskLike, toDate: string): RescheduledTaskFields {
  return {
    title: task.title,
    why: task.why,
    effortMinutes: task.effortMinutes,
    tier: task.tier,
    sequence: task.sequence,
    scheduledFor: toDate,
    status: "pending",
    isUserAdded: false,
  };
}
