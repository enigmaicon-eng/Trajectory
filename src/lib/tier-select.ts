export type TierKey = "minimum" | "normal" | "ideal";

const ORDER: TierKey[] = ["minimum", "normal", "ideal"];

/**
 * §21 open question #1, resolved: the day tier defaults to the largest tier
 * whose minute budget still fits a stated `minutesAvailable` (from a forward
 * check-in); with no check-in today, defaults to the capacity profile's
 * normal day. Shared between the server (initial render) and the client
 * (recomputing the consequence line after a check-in saves, §10.3) so the
 * two never drift.
 */
export function pickDefaultTier(minutesAvailable: number | null, budget: Record<TierKey, number>): TierKey {
  if (minutesAvailable == null) return "normal";
  let best: TierKey = "minimum";
  for (const tier of ORDER) {
    if (budget[tier] <= minutesAvailable) best = tier;
  }
  return best;
}

export const TIER_ORDER = ORDER;
