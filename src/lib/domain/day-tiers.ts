// Deterministic day-tier packer (§5.2 `plan_day`, §6.3 "minimum-viable day is
// always one tap away"). The AI may add a one-line framing on top, but the
// three selectable tiers themselves — which of today's already-scheduled
// tasks make up minimum / normal / ideal — are computed here, purely, so
// /today always renders correctly even with the AI provider disabled
// (AC-5.19). No I/O, no framework imports.

export interface DayTaskLike {
  effortMinutes: number;
  tier: "minimum" | "normal" | "ideal";
  sequence: number;
}

export interface DayCapacityBudget {
  idealMinutes: number;
  normalMinutes: number;
  minimumMinutes: number;
}

export interface DayTierSets<T> {
  minimum: T[];
  normal: T[];
  ideal: T[];
}

const TIER_RANK: Record<DayTaskLike["tier"], number> = { minimum: 0, normal: 1, ideal: 2 };

/** Greedily keeps tasks (in the given order) while they fit the budget — but always keeps at least the first one. */
function packByBudget<T extends { effortMinutes: number }>(tasks: T[], budgetMinutes: number): T[] {
  const kept: T[] = [];
  let total = 0;
  for (const t of tasks) {
    if (kept.length === 0 || total + t.effortMinutes <= budgetMinutes) {
      kept.push(t);
      total += t.effortMinutes;
    }
  }
  return kept;
}

function cheapest<T extends { effortMinutes: number }>(tasks: T[]): T[] {
  if (tasks.length === 0) return [];
  return [tasks.reduce((a, b) => (b.effortMinutes < a.effortMinutes ? b : a))];
}

/**
 * Splits today's scheduled tasks into three nested tiers. `minimum` is never
 * empty when `tasks` is non-empty (§7: "every day with any planned work" gets
 * a genuinely progress-bearing minimum-viable subset), even if the cheapest
 * available task slightly overflows `minimumMinutes` — a chaotic day still
 * gets one concrete thing to do rather than nothing.
 */
export function packDayTiers<T extends DayTaskLike>(tasks: T[], capacity: DayCapacityBudget): DayTierSets<T> {
  const sorted = [...tasks].sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.sequence - b.sequence);
  const minimumCandidates = sorted.filter((t) => t.tier === "minimum");
  const normalCandidates = sorted.filter((t) => t.tier === "minimum" || t.tier === "normal");

  return {
    minimum: packByBudget(minimumCandidates.length > 0 ? minimumCandidates : cheapest(sorted), capacity.minimumMinutes),
    normal: packByBudget(normalCandidates, capacity.normalMinutes),
    ideal: packByBudget(sorted, capacity.idealMinutes),
  };
}
