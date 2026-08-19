// Shared display formatting — §0.4 "every number is set in tabular figures."
// Pair every call site with the `tabular-nums` class; this module only
// produces the text.

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const DAY_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** ISO weekday (1 = Monday) → short label, per §8's day list. */
export function weekdayLabel(isoWeekday: number): string {
  return DAY_LABEL[isoWeekday - 1] ?? "";
}

export function formatDateHuman(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// §6.1: "comparable_basis and confidence are always shown ... Never a
// percentage ring, never a gauge" — a sentence, bucketed rather than a raw
// decimal, matches that everywhere a feasibility confidence is surfaced.
export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.7) return "High confidence.";
  if (confidence >= 0.4) return "Moderate confidence.";
  return "Low confidence.";
}
