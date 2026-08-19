"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { StandingAnswer } from "@/components/ui/StandingAnswer";
import { buttonClass } from "@/components/ui/button-styles";
import { formatMinutes } from "@/lib/format";
import { pickDefaultTier, type TierKey } from "@/lib/tier-select";
import { completeTask, skipTask, undoTaskCompletion, deferTask, submitCheckIn } from "@/server/actions/execution";

export interface TodayTaskVM {
  id: string;
  title: string;
  why: string | null;
  effortMinutes: number;
}

const TIER_LABEL: Record<TierKey, string> = { minimum: "minimum", normal: "normal", ideal: "ideal" };
const TIER_ORDER: TierKey[] = ["minimum", "normal", "ideal"];

interface TodayBodyProps {
  goalId: string;
  todayISO: string;
  standingLine1: string;
  standingLine2: string | null;
  tiers: Record<TierKey, TodayTaskVM[]>;
  doneIds: string[];
  tierMinutes: Record<TierKey, number>;
  defaultTier: TierKey;
  doneCount: number;
  totalCount: number;
  missed: { id: string; title: string; effortMinutes: number }[];
  weekContextLine: string | null;
  replanNotice: { id: string; lead: string; line: string } | null;
  hasForwardCheckinToday: boolean;
  isFirstRun: boolean;
}

export function TodayBody({
  goalId,
  todayISO,
  standingLine1,
  standingLine2,
  tiers,
  doneIds: initialDoneIds,
  tierMinutes,
  defaultTier,
  doneCount: initialDoneCount,
  totalCount,
  missed: initialMissed,
  weekContextLine,
  replanNotice,
  hasForwardCheckinToday,
  isFirstRun,
}: TodayBodyProps) {
  const [selectedTier, setSelectedTier] = useState<TierKey>(defaultTier);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set(initialDoneIds));
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [recentlyUndoable, setRecentlyUndoable] = useState<Set<string>>(new Set());
  const [missed, setMissed] = useState(initialMissed);
  const [announcement, setAnnouncement] = useState("");
  const [dismissedFirstRun, setDismissedFirstRun] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinConsequence, setCheckinConsequence] = useState<string | null>(null);
  const [tierAtLastCheckin, setTierAtLastCheckin] = useState(defaultTier);
  const [, startTransition] = useTransition();

  const visibleTasks = useMemo(
    () => tiers[selectedTier].filter((t) => !skippedIds.has(t.id)),
    [tiers, selectedTier, skippedIds],
  );
  const skippedTasks = useMemo(
    () => tiers[selectedTier].filter((t) => skippedIds.has(t.id)),
    [tiers, selectedTier, skippedIds],
  );
  const selectedMinutes = visibleTasks
    .filter((t) => !doneIds.has(t.id))
    .reduce((sum, t) => sum + t.effortMinutes, 0);
  const pendingLeft = visibleTasks.filter((t) => !doneIds.has(t.id)).length;
  const liveDoneCount = initialDoneCount + [...doneIds].filter((id) => !initialDoneIds.includes(id)).length;

  function handleSelectTier(tier: TierKey) {
    setSelectedTier(tier);
    const left = tiers[tier].filter((t) => !doneIds.has(t.id) && !skippedIds.has(t.id)).length;
    setAnnouncement(`${formatMinutes(tierMinutes[tier])} plan. ${left} task${left === 1 ? "" : "s"}.`);
  }

  function handleComplete(taskId: string) {
    setDoneIds((prev) => new Set(prev).add(taskId));
    setRecentlyUndoable((prev) => new Set(prev).add(taskId));
    const remaining = pendingLeft - 1;
    setAnnouncement(remaining > 0 ? `Done. ${remaining} task${remaining === 1 ? "" : "s"} left today.` : "That's today.");
    startTransition(async () => {
      try {
        await completeTask({ taskId });
      } catch {
        setDoneIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
        setAnnouncement("That didn't save. Try again.");
      }
    });
  }

  function handleUndo(taskId: string) {
    setDoneIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    startTransition(async () => {
      try {
        await undoTaskCompletion({ taskId });
      } catch {
        setDoneIds((prev) => new Set(prev).add(taskId));
      }
    });
  }

  function handleSkip(taskId: string) {
    setSkippedIds((prev) => new Set(prev).add(taskId));
    startTransition(async () => {
      try {
        await skipTask({ taskId });
      } catch {
        setSkippedIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    });
  }

  function handleCarry(taskId: string) {
    setMissed((prev) => prev.filter((m) => m.id !== taskId));
    startTransition(async () => {
      try {
        await deferTask({ taskId, toDate: todayISO });
      } catch {
        // The row already left the list optimistically; a reload will show
        // the true state if the server call failed.
      }
    });
  }

  const shownMissed = missed.slice(0, 3);
  const overflowMissed = missed.length - shownMissed.length;

  const contextualBlock: "missed" | "proposal" | "first-run" | null =
    shownMissed.length > 0 ? "missed" : replanNotice ? "proposal" : isFirstRun && !dismissedFirstRun ? "first-run" : null;

  return (
    <div className="flex flex-col gap-8">
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <StandingAnswer line1={standingLine1} line2={standingLine2} />

      {contextualBlock === "first-run" && (
        <p className="text-sm text-ink-muted">
          Pick the version of today that fits the time you actually have.{" "}
          <button
            type="button"
            onClick={() => setDismissedFirstRun(true)}
            className="underline decoration-rule underline-offset-2 hover:text-ink"
          >
            Got it
          </button>
        </p>
      )}

      {totalCount > 0 && (
        <div
          role="radiogroup"
          aria-label="Time available today"
          className="sticky top-0 -mx-6 flex gap-2 border-b border-rule bg-paper px-6 pb-4 pt-2 sm:static sm:mx-0 sm:px-0 sm:pt-0"
        >
          {TIER_ORDER.map((tier) => (
            <button
              key={tier}
              type="button"
              role="radio"
              aria-checked={selectedTier === tier}
              onClick={() => {
                handleSelectTier(tier);
                setDismissedFirstRun(true);
              }}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center rounded-md border px-2 text-center transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
                selectedTier === tier ? "border-accent bg-paper-raised" : "border-rule text-ink-muted hover:bg-paper-raised"
              }`}
            >
              <span className="text-base font-medium tabular-nums text-ink">{formatMinutes(tierMinutes[tier])}</span>
              <span className="text-xs text-ink-muted">{TIER_LABEL[tier]}</span>
            </button>
          ))}
        </div>
      )}

      {totalCount === 0 ? (
        <p className="text-sm text-ink-muted">
          Nothing scheduled today. Everything planned lives on{" "}
          <Link href={`/goals/${goalId}/week`} className="underline decoration-rule underline-offset-2 hover:text-ink">
            this week
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="flex items-baseline justify-between text-sm text-ink-muted">
            <span>
              {liveDoneCount} of {totalCount} done today
            </span>
            <span className="tabular-nums">{formatMinutes(selectedMinutes)} left in this tier</span>
          </div>

          {visibleTasks.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing in this tier — everything&apos;s already done.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {visibleTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  done={doneIds.has(t.id)}
                  showUndo={recentlyUndoable.has(t.id)}
                  onComplete={() => handleComplete(t.id)}
                  onUndo={() => handleUndo(t.id)}
                  onSkip={() => handleSkip(t.id)}
                />
              ))}
            </ul>
          )}

          {skippedTasks.length > 0 && (
            <div className="border-t border-rule pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Skipped today</p>
              <ul className="mt-2 flex flex-col gap-1">
                {skippedTasks.map((t) => (
                  <li key={t.id} className="flex min-h-11 items-center justify-between text-sm text-ink-faint line-through">
                    <span>{t.title}</span>
                    <span className="tabular-nums">{formatMinutes(t.effortMinutes)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {contextualBlock === "missed" && (
        <div className="flex flex-col gap-2 border-t border-rule pt-6">
          <p className="text-sm font-medium text-ink">Not done yesterday</p>
          <ul className="flex flex-col gap-2">
            {shownMissed.map((m) => (
              <li key={m.id} className="flex min-h-11 flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-ink">{m.title}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums text-ink-muted">{formatMinutes(m.effortMinutes)}</span>
                  <button
                    type="button"
                    onClick={() => handleCarry(m.id)}
                    className="text-sm text-ink underline decoration-rule underline-offset-2 hover:text-accent"
                  >
                    Carry into today
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {overflowMissed > 0 && (
            <Link href={`/goals/${goalId}/week`} className="text-sm text-ink-muted underline decoration-rule underline-offset-2">
              and {overflowMissed} more this week →
            </Link>
          )}
        </div>
      )}

      {contextualBlock === "proposal" && replanNotice && (
        <Link
          href={`/goals/${goalId}/history`}
          className="flex items-baseline justify-between gap-4 border-t border-rule pt-4 text-sm text-ink hover:text-accent"
        >
          <span>
            <span className="font-medium">{replanNotice.lead}</span> {replanNotice.line}
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      <div className="flex flex-col gap-3 border-t border-rule pt-6 text-sm text-ink-muted">
        {weekContextLine && <p>{weekContextLine}</p>}
        {checkinConsequence ? (
          <p className="text-ink">{checkinConsequence}</p>
        ) : (
          <button
            type="button"
            onClick={() => setCheckinOpen(true)}
            className="self-start text-ink underline decoration-rule underline-offset-2 hover:text-accent"
          >
            Check in
          </button>
        )}
      </div>

      {checkinOpen && (
        <CheckInSheet
          goalId={goalId}
          todayISO={todayISO}
          variant={hasForwardCheckinToday ? "evening" : "forward"}
          tierMinutes={tierMinutes}
          firstTaskTitle={tiers[tierAtLastCheckin]?.find((t) => !doneIds.has(t.id))?.title ?? null}
          onClose={() => setCheckinOpen(false)}
          onSaved={(minutesAvailable) => {
            setCheckinOpen(false);
            if (minutesAvailable != null) {
              const nextTier = pickDefaultTier(minutesAvailable, tierMinutes);
              setTierAtLastCheckin(nextTier);
              const changed = nextTier !== selectedTier;
              setSelectedTier(nextTier);
              const firstTitle = tiers[nextTier]?.find((t) => !doneIds.has(t.id))?.title;
              setCheckinConsequence(
                changed && firstTitle
                  ? `Today is the ${TIER_LABEL[nextTier]} version. One thing: ${firstTitle}.`
                  : "Today's plan already fits.",
              );
            } else {
              setCheckinConsequence("Saved. Today's plan is unchanged.");
            }
          }}
        />
      )}
    </div>
  );
}

function TaskRow({
  task,
  done,
  showUndo,
  onComplete,
  onUndo,
  onSkip,
}: {
  task: TodayTaskVM;
  done: boolean;
  showUndo: boolean;
  onComplete: () => void;
  onUndo: () => void;
  onSkip: () => void;
}) {
  return (
    <li className="flex min-h-14 flex-col justify-center gap-0.5 border-b border-rule py-2 last:border-b-0">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={done ? undefined : onComplete}
          disabled={done}
          aria-pressed={done}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
            done ? "border-health-on bg-health-on text-paper" : "border-ink-faint hover:border-ink"
          }`}
          aria-label={done ? `${task.title}, done` : `Mark "${task.title}" done`}
        >
          {done && <span aria-hidden="true">✓</span>}
        </button>
        <button
          type="button"
          onClick={done ? undefined : onComplete}
          disabled={done}
          className={`flex flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-left transition-opacity duration-150 ease-out ${
            done ? "opacity-50" : ""
          }`}
        >
          <span className={`text-base text-ink ${done ? "line-through" : ""}`}>{task.title}</span>
          <span className="tabular-nums text-sm text-ink-muted">{formatMinutes(task.effortMinutes)}</span>
        </button>
      </div>
      {task.why && !done && <p className="pl-8 text-sm text-ink-muted">{task.why}</p>}
      <div className="pl-8">
        {done ? (
          showUndo && (
            <button type="button" onClick={onUndo} className="text-sm text-ink-muted underline decoration-rule underline-offset-2 hover:text-ink">
              Undo
            </button>
          )
        ) : (
          <button type="button" onClick={onSkip} className="text-sm text-ink-faint underline decoration-rule underline-offset-2 hover:text-ink-muted">
            Skip
          </button>
        )}
      </div>
    </li>
  );
}

const MINUTE_CHIPS = [15, 30, 60, 90];
const ENERGY_LEVELS = [1, 2, 3, 4, 5];

function CheckInSheet({
  goalId,
  todayISO,
  variant,
  tierMinutes: _tierMinutes,
  firstTaskTitle: _firstTaskTitle,
  onClose,
  onSaved,
}: {
  goalId: string;
  todayISO: string;
  variant: "forward" | "evening";
  tierMinutes: Record<TierKey, number>;
  firstTaskTitle: string | null;
  onClose: () => void;
  onSaved: (minutesAvailable: number | null) => void;
}) {
  const [minutes, setMinutes] = useState<number | "other" | null>(null);
  const [customMinutes, setCustomMinutes] = useState("");
  const [energy, setEnergy] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(false);
    const minutesAvailable =
      variant === "forward" ? (minutes === "other" ? Number(customMinutes) || null : minutes) : null;
    try {
      await submitCheckIn({
        goalId,
        kind: "daily",
        occurredOn: todayISO,
        minutesAvailable: minutesAvailable ?? undefined,
        energy: energy ?? undefined,
        note: variant === "evening" && note.trim() ? note.trim() : undefined,
      });
      onSaved(minutesAvailable);
    } catch {
      setError(true);
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={variant === "forward" ? "How much time do you have today" : "How did today go"}
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink/20 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col gap-5 rounded-t-lg border border-rule bg-paper-raised p-6 sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {variant === "forward" ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-ink">How much time do you have today?</p>
            <div className="flex flex-wrap gap-2">
              {MINUTE_CHIPS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinutes(m)}
                  aria-pressed={minutes === m}
                  className={`min-h-11 rounded-full border px-4 text-sm transition-colors duration-150 ease-out ${
                    minutes === m ? "border-accent bg-paper text-ink" : "border-rule text-ink-muted hover:bg-paper"
                  }`}
                >
                  {m}m
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMinutes("other")}
                aria-pressed={minutes === "other"}
                className={`min-h-11 rounded-full border px-4 text-sm transition-colors duration-150 ease-out ${
                  minutes === "other" ? "border-accent bg-paper text-ink" : "border-rule text-ink-muted hover:bg-paper"
                }`}
              >
                Other
              </button>
            </div>
            {minutes === "other" && (
              <label className="flex flex-col gap-1 text-sm text-ink-muted">
                Minutes
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="w-24 rounded-md border border-rule bg-paper px-3 py-2 text-base text-ink"
                />
              </label>
            )}
          </div>
        ) : (
          <p className="text-sm font-medium text-ink">How&apos;s today gone?</p>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink">How&apos;s your energy?</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-faint">low</span>
            <div role="radiogroup" aria-label="Energy" className="flex flex-1 justify-between gap-1">
              {ENERGY_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={energy === level}
                  aria-label={`Energy ${level} of 5`}
                  onClick={() => setEnergy(level)}
                  className={`h-8 w-8 rounded-full border transition-colors duration-150 ease-out ${
                    energy === level ? "border-accent bg-accent" : "border-rule hover:bg-paper"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-ink-faint">high</span>
          </div>
        </div>

        {variant === "evening" && (
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Anything worth noting? (optional)
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-md border border-rule bg-paper px-3 py-2 text-base text-ink"
            />
          </label>
        )}

        {error && <p role="alert" className="text-sm text-danger-ink">Not saved — retry.</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={buttonClass("ghost")}>
            Dismiss
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className={buttonClass("primary")}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
