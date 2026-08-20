import { formatPercent, formatDateHuman } from "@/lib/format";

// §13 "Progress view": the surface that answers "how far along am I, honestly,
// and where does that land me?" — and §13.5's "why this number" affordance.
// This component is the "why is my goal in this state?" answer: a single
// synthesized headline (computed deterministically in lib/domain/goal-health,
// never AI-narrated — it must render with the AI provider disabled, same as
// the Standing Answer) backed by the concrete signals it was drawn from.
// Explanation over decorative scores: no sparkline, no gauge, no card grid —
// an aligned list of numbers, each openable to its derivation (§13.3, §13.5).

export type SignalField =
  | { value: number | string; meaning: string; basis: string; caveat?: string | null }
  | { caveat: string };

function hasValue(field: SignalField | undefined): field is { value: number | string; meaning: string; basis: string; caveat?: string | null } {
  return !!field && "value" in field;
}

const SIGNAL_ROWS = [
  ["Execution rate", "executionRate", (v: number | string) => formatPercent(v as number)],
  ["Momentum", "momentum", (v: number | string) => `${v}`],
  ["Plan confidence", "planConfidence", (v: number | string) => formatPercent(v as number)],
  ["Projected finish", "projectedCompletion", (v: number | string) => formatDateHuman(v as string)],
] as const;

export interface GoalHealthExplanationProps {
  /** The synthesized "why" sentence — the answer, not a data point. Null when there's no signals snapshot yet at all. */
  headline: string | null;
  explanation: Record<string, SignalField> | null;
}

export function GoalHealthExplanation({ headline, explanation }: GoalHealthExplanationProps) {
  if (!headline || !explanation) {
    return (
      <p className="text-sm text-ink-muted">
        Not enough data yet. After seven days of execution, these become meaningful.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-ink">{headline}</p>
      <dl className="flex flex-col">
        {SIGNAL_ROWS.map(([label, key, format]) => {
          const field = explanation[key];
          return (
            <div key={key} className="flex items-center justify-between gap-4 border-b border-rule py-2 last:border-b-0">
              <dt className="text-sm text-ink-muted">{label}</dt>
              {hasValue(field) ? (
                <details className="group text-right">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm">
                    <span className="font-medium tabular-nums text-ink">{format(field.value)}</span>
                    <span aria-hidden="true" className="text-ink-faint">
                      ⓘ
                    </span>
                  </summary>
                  <div className="mt-1 flex max-w-xs flex-col gap-1 text-left text-xs text-ink-muted">
                    <p>
                      <span className="text-ink-faint">What it means </span>
                      {field.meaning}
                    </p>
                    <p>
                      <span className="text-ink-faint">Where it comes from </span>
                      {field.basis}
                    </p>
                    {field.caveat && (
                      <p>
                        <span className="text-ink-faint">Caveat </span>
                        {field.caveat}
                      </p>
                    )}
                  </div>
                </details>
              ) : (
                <dd className="text-sm text-ink-faint">— {field?.caveat ?? "not enough data"}</dd>
              )}
            </div>
          );
        })}
      </dl>
    </div>
  );
}
