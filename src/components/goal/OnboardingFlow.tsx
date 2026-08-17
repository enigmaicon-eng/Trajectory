"use client";

import { useState } from "react";
import Link from "next/link";
import { answerIntake, commitGoal, type GoalDraft } from "@/server/actions/goal";
import type { AssessOutput } from "@/lib/ai/modules/assess/output.schema";
import { buttonClass } from "@/components/ui/button-styles";

type Choice = "proceed" | "extend" | "narrow";
type Step = "questions" | "assessing" | "assessment" | "committing" | "error" | "quota";

function formatResetsAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "soon";
  }
}

const VERDICT_LABEL: Record<AssessOutput["verdict"], string> = {
  realistic: "Realistic",
  ambitious_but_possible: "Ambitious, but possible",
  unrealistic_as_stated: "Not realistic as stated",
};

export function OnboardingFlow({ initialDraft }: { initialDraft: GoalDraft }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [assessment, setAssessment] = useState<AssessOutput | undefined>(
    initialDraft.assessment,
  );
  const [step, setStep] = useState<Step>(assessment ? "assessment" : "questions");
  const [quotaResetsAt, setQuotaResetsAt] = useState<string | null>(null);

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

  function handleAnswersSubmit(event: React.FormEvent) {
    event.preventDefault();
    void submitAnswers();
  }

  async function handleChoice(choice: Choice) {
    setStep("committing");
    try {
      const result = await commitGoal({ choice });
      // On success commitGoal redirects server-side (sign-in, or /goals).
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
      <div className="flex flex-col gap-3">
        <p className="text-sm text-neutral-800">
          You&apos;ve hit the free plan&apos;s limit for building new plans right now. It resets{" "}
          {quotaResetsAt ? formatResetsAt(quotaResetsAt) : "soon"}.
        </p>
        <p className="text-sm text-neutral-600">
          Your goal is saved — nothing is lost. Add your own key to remove this limit and
          finish building it now.
        </p>
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
      <div className="flex flex-col gap-3">
        <p className="text-sm text-red-600">We couldn&apos;t produce a reliable plan.</p>
        <button
          onClick={() => setStep(assessment ? "assessment" : "questions")}
          className={`self-start ${buttonClass("secondary")}`}
        >
          Retry
        </button>
      </div>
    );
  }

  if (step === "questions" || step === "assessing") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-medium">{initialDraft.clarify.title}</h1>
          <p className="mt-1 text-neutral-600">{initialDraft.clarify.outcomeStatement}</p>
        </div>

        {initialDraft.clarify.questions.length > 0 ? (
          <form onSubmit={handleAnswersSubmit} className="flex flex-col gap-4">
            {initialDraft.clarify.questions.map((q) => (
              <label key={q.id} className="flex flex-col gap-1 text-sm">
                {q.prompt}
                <input
                  type="text"
                  placeholder="Skip if you're not sure"
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                  className="rounded-md border border-neutral-300 px-3 py-2"
                />
              </label>
            ))}
            <button
              type="submit"
              disabled={step === "assessing"}
              className={`self-start ${buttonClass("primary")}`}
            >
              {step === "assessing" ? "Assessing feasibility..." : "Continue"}
            </button>
          </form>
        ) : (
          <button
            onClick={() => void submitAnswers()}
            disabled={step === "assessing"}
            className={`self-start ${buttonClass("primary")}`}
          >
            {step === "assessing" ? "Assessing feasibility..." : "Continue"}
          </button>
        )}
        <p role="status" aria-live="polite" className="sr-only">
          {step === "assessing" ? "Assessing feasibility" : ""}
        </p>
      </div>
    );
  }

  if (!assessment) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="text-xs uppercase tracking-wide text-neutral-500">
          {VERDICT_LABEL[assessment.verdict]}
        </span>
        <p className="mt-2 text-neutral-800">{assessment.rationale}</p>
      </div>

      {assessment.keyRisks.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm text-neutral-700">
          {assessment.keyRisks.map((r, i) => (
            <li key={i}>
              <span className="font-medium">{r.risk}</span> ({r.severity}) — {r.mitigation}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3">
        {assessment.verdict === "unrealistic_as_stated" && assessment.alternative ? (
          <>
            <button
              onClick={() => handleChoice("extend")}
              disabled={step === "committing"}
              className={buttonClass("primary")}
            >
              Extend the timeline
            </button>
            <button
              onClick={() => handleChoice("narrow")}
              disabled={step === "committing"}
              className={buttonClass("secondary")}
            >
              Narrow the outcome
            </button>
            <button
              onClick={() => handleChoice("proceed")}
              disabled={step === "committing"}
              className={buttonClass("secondary")}
            >
              Proceed anyway
            </button>
          </>
        ) : (
          <button
            onClick={() => handleChoice("proceed")}
            disabled={step === "committing"}
            className={buttonClass("primary")}
          >
            {step === "committing" ? "Building your plan..." : "Build my plan"}
          </button>
        )}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {step === "committing" ? "Building your plan" : ""}
      </p>
    </div>
  );
}
