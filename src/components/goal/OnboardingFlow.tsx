"use client";

import { useState } from "react";
import Link from "next/link";
import { answerIntake, commitGoal, createGoalDraft, type GoalDraft } from "@/server/actions/goal";
import type { AssessOutput } from "@/lib/ai/modules/assess/output.schema";
import { buttonClass } from "@/components/ui/button-styles";
import { HealthMark } from "@/components/ui/HealthMark";
import { confidenceLabel } from "@/lib/format";

type Choice = "proceed" | "extend" | "narrow";
type Step = "questions" | "assessing" | "assessment" | "committing" | "error" | "quota";

function formatResetsAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return "soon";
  }
}

const SEVERITY_MARK: Record<AssessOutput["keyRisks"][number]["severity"], "on_track" | "at_risk" | "off_track"> = {
  low: "on_track",
  medium: "at_risk",
  high: "off_track",
};

function verdictHeadline(verdict: AssessOutput["verdict"]): string {
  if (verdict === "realistic") return "This is realistic.";
  if (verdict === "ambitious_but_possible") return "Ambitious, but possible.";
  return "This isn't enough time as stated.";
}

// §4: "A single hairline rule under the header, filling across four
// segments. No numbered circles, no 'Step 2 of 4' label."
function ProgressRule({ stage }: { stage: 0 | 1 | 2 | 3 }) {
  return (
    <div className="flex gap-1" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`h-0.5 flex-1 rounded-full ${i <= stage ? "bg-accent" : "bg-rule"}`} />
      ))}
    </div>
  );
}

export function OnboardingFlow({ initialDraft }: { initialDraft: GoalDraft }) {
  const [draft, setDraft] = useState(initialDraft);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [assessment, setAssessment] = useState<AssessOutput | undefined>(initialDraft.assessment);
  const [step, setStep] = useState<Step>(assessment ? "assessment" : "questions");
  const [quotaResetsAt, setQuotaResetsAt] = useState<string | null>(null);
  const [editingOutcome, setEditingOutcome] = useState(false);
  const [rawInputDraft, setRawInputDraft] = useState(initialDraft.rawInput);
  const [reclarifying, setReclarifying] = useState(false);

  async function submitAnswers() {
    setStep("assessing");
    try {
      const result = await answerIntake({ answers });
      setAssessment(result.assessment);
      setStep("assessment");
    } catch {
      setStep("error");
    }
  }

  async function handleReclarify() {
    if (rawInputDraft.trim().length < 10) return;
    setReclarifying(true);
    try {
      const result = await createGoalDraft({ rawInput: rawInputDraft.trim() });
      setDraft({ rawInput: rawInputDraft.trim(), clarify: result.clarification, answers: {} });
      setAnswers({});
      setEditingOutcome(false);
    } catch {
      setStep("error");
    } finally {
      setReclarifying(false);
    }
  }

  async function handleChoice(choice: Choice) {
    setStep("committing");
    try {
      const result = await commitGoal({ choice });
      if (result?.error === "quota_exceeded") {
        setQuotaResetsAt(result.resetsAt);
        setStep("quota");
      }
    } catch {
      setStep("error");
    }
  }

  if (step === "quota") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink">
          The free plan&apos;s limit for building new plans is used up right now. It resets{" "}
          {quotaResetsAt ? formatResetsAt(quotaResetsAt) : "soon"}.
        </p>
        <p className="text-sm text-ink-muted">Your goal is saved — nothing is lost. Add your own key to finish building it now.</p>
        <div className="flex gap-3">
          <Link href="/settings/ai" className={buttonClass("primary")}>
            Add a key
          </Link>
          <Link href="/goals" className={buttonClass("secondary")}>
            Back to your goals
          </Link>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink">We couldn&apos;t produce a plan we&apos;d trust. Nothing was saved.</p>
        <div className="flex gap-3">
          <button onClick={() => setStep(assessment ? "assessment" : "questions")} className={buttonClass("primary")}>
            Try again
          </button>
          <button onClick={() => setEditingOutcome(true)} className={buttonClass("secondary")}>
            Change what I wrote
          </button>
        </div>
      </div>
    );
  }

  if (step === "questions" || step === "assessing") {
    return (
      <div className="flex flex-col gap-8">
        <ProgressRule stage={0} />

        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">Here&apos;s what we understood</p>
          {editingOutcome ? (
            <div className="flex flex-col gap-2">
              <textarea
                rows={2}
                value={rawInputDraft}
                onChange={(e) => setRawInputDraft(e.target.value)}
                className="rounded-md border border-rule bg-paper px-3 py-2 text-lg text-ink"
              />
              <div className="flex gap-3">
                <button onClick={() => void handleReclarify()} disabled={reclarifying} className={buttonClass("primary", "small")}>
                  {reclarifying ? "Working…" : "Update"}
                </button>
                <button onClick={() => setEditingOutcome(false)} className={buttonClass("ghost", "small")}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="measure text-[28px] font-normal leading-tight text-ink">{draft.clarify.outcomeStatement}</p>
              <button
                onClick={() => setEditingOutcome(true)}
                className="text-sm text-ink-muted underline decoration-rule underline-offset-2 hover:text-ink"
              >
                edit
              </button>
            </div>
          )}
        </div>

        {draft.clarify.questions.length > 0 ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitAnswers();
            }}
            className="flex flex-col gap-6"
          >
            <p className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">
              {draft.clarify.questions.length === 1
                ? "One thing that changes the plan"
                : `${draft.clarify.questions.length} things that change the plan`}
            </p>
            <ol className="flex flex-col gap-4">
              {draft.clarify.questions.map((q, i) => (
                <li key={q.id} className="flex flex-col gap-1.5">
                  <label htmlFor={`q-${q.id}`} className="text-sm text-ink">
                    {i + 1}. {q.prompt}
                  </label>
                  <input
                    id={`q-${q.id}`}
                    type="text"
                    enterKeyHint="next"
                    placeholder="Skip if you're not sure"
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    className="rounded-md border border-rule bg-paper px-3 py-2 text-base text-ink"
                  />
                </li>
              ))}
            </ol>
            <div className="flex items-center justify-between gap-4">
              <button type="button" onClick={() => void submitAnswers()} disabled={step === "assessing"} className={buttonClass("text")}>
                Skip the rest
              </button>
              <button type="submit" disabled={step === "assessing"} className={buttonClass("primary")}>
                {step === "assessing" ? "Working…" : "Continue →"}
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => void submitAnswers()} disabled={step === "assessing"} className={`self-start ${buttonClass("primary")}`}>
            {step === "assessing" ? "Working…" : "Continue →"}
          </button>
        )}
        <p role="status" aria-live="polite" className="sr-only">
          {step === "assessing" ? "Checking whether this timeline works" : ""}
        </p>
      </div>
    );
  }

  if (!assessment) return null;

  const isFork = assessment.verdict === "unrealistic_as_stated" && assessment.alternative;

  return (
    <div className="flex flex-col gap-8">
      <ProgressRule stage={1} />

      <div className="flex flex-col gap-3">
        <p className="measure text-[28px] font-normal leading-tight text-ink">{verdictHeadline(assessment.verdict)}</p>
        <p className="measure text-base text-ink-muted">{assessment.rationale}</p>
      </div>

      {assessment.keyRisks.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">
            {isFork ? "Why" : "What makes it hard"}
          </p>
          <ul className="flex flex-col gap-2">
            {assessment.keyRisks.map((r, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                <span className="flex items-center gap-2">
                  <HealthMark health={SEVERITY_MARK[r.severity]} />
                  <span className="text-ink">{r.risk}</span>
                </span>
                <span className="text-ink-faint">{r.mitigation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(assessment.comparableBasis || true) && (
        <p className="text-sm text-ink-faint">
          {assessment.comparableBasis ? `Based on ${assessment.comparableBasis}. ` : ""}
          {confidenceLabel(assessment.confidence)}
        </p>
      )}

      {isFork && assessment.alternative ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">Three ways forward</p>
          <OptionCard
            title="Narrow the outcome"
            recommended
            body={`${assessment.alternative.outcomeStatement} — ${assessment.alternative.whyStronger}`}
            onChoose={() => handleChoice("narrow")}
            disabled={step === "committing"}
          />
          <OptionCard
            title="Extend the timeline"
            body={`Keep the outcome, plan across ${assessment.alternative.horizonWeeks} weeks instead.`}
            onChoose={() => handleChoice("extend")}
            disabled={step === "committing"}
          />
          <OptionCard
            title="Plan it anyway"
            body="Build the strongest version in the original timeframe, and track the gap honestly."
            onChoose={() => handleChoice("proceed")}
            disabled={step === "committing"}
          />
        </div>
      ) : (
        <button onClick={() => void handleChoice("proceed")} disabled={step === "committing"} className={`self-start ${buttonClass("primary")}`}>
          {step === "committing" ? "Building your plan…" : "Build the plan →"}
        </button>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {step === "committing" ? "Building your plan" : ""}
      </p>
    </div>
  );
}

function OptionCard({
  title,
  body,
  recommended,
  onChoose,
  disabled,
}: {
  title: string;
  body: string;
  recommended?: boolean;
  onChoose: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 border border-rule p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium text-ink">{title}</p>
        {recommended && <span className="text-xs uppercase tracking-wide text-ink-muted">Recommended</span>}
      </div>
      <p className="text-sm text-ink-muted">{body}</p>
      <button onClick={onChoose} disabled={disabled} className={`self-start ${buttonClass("secondary", "small")}`}>
        Choose this
      </button>
    </div>
  );
}
