"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { draftCookie, encodeDraftToken, decodeDraftToken } from "@/lib/security/draft-token";
import { runClarify } from "@/lib/ai/modules/clarify";
import { runAssess } from "@/lib/ai/modules/assess";
import { decomposeGoal } from "@/server/actions/decompose";
import type { ClarifyOutput } from "@/lib/ai/modules/clarify/output.schema";
import type { AssessOutput } from "@/lib/ai/modules/assess/output.schema";

export interface GoalDraft {
  rawInput: string;
  clarify: ClarifyOutput;
  answers: Record<string, string>;
  assessment?: AssessOutput;
}

async function readDraft(): Promise<GoalDraft | null> {
  const store = await cookies();
  const token = store.get(draftCookie.name)?.value;
  if (!token) return null;
  return decodeDraftToken<GoalDraft>(token);
}

async function writeDraft(draft: GoalDraft) {
  const store = await cookies();
  store.set(draftCookie.name, encodeDraftToken(draft), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: draftCookie.maxAgeSeconds,
    path: "/",
  });
}

export async function getDraftState(): Promise<GoalDraft | null> {
  return readDraft();
}

export async function createGoalDraft(input: { rawInput: string }) {
  const db = await createClient();
  const clarification = await runClarify(
    { rawInput: input.rawInput },
    { userId: null, traceId: randomUUID(), db },
  );

  await writeDraft({ rawInput: input.rawInput, clarify: clarification, answers: {} });
  return { clarification };
}

export async function answerIntake(input: { answers: Record<string, string> }) {
  const draft = await readDraft();
  if (!draft) throw new Error("No active goal draft. Start over.");

  const db = await createClient();
  const assessment = await runAssess(
    {
      rawInput: draft.rawInput,
      outcomeStatement: draft.clarify.outcomeStatement,
      domain: draft.clarify.domain,
      targetDate: draft.clarify.targetDate,
      horizonWeeks: draft.clarify.horizonWeeks,
      answers: input.answers,
    },
    { userId: null, traceId: randomUUID(), db },
  );

  await writeDraft({ ...draft, answers: input.answers, assessment });
  return { assessment };
}

export async function commitGoal(input: { choice: "proceed" | "extend" | "narrow" }) {
  const draft = await readDraft();
  if (!draft || !draft.assessment) throw new Error("No assessed goal draft. Start over.");

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    redirect(
      `/auth/sign-in?next=${encodeURIComponent(`/start?choice=${input.choice}`)}`,
    );
  }

  let outcomeStatement = draft.clarify.outcomeStatement;
  let horizonWeeks = draft.clarify.horizonWeeks;
  let targetDate = draft.clarify.targetDate;

  if (input.choice === "extend" && draft.assessment.alternative) {
    horizonWeeks = draft.assessment.alternative.horizonWeeks;
    targetDate = null; // horizon-driven instead of a fixed date
  } else if (input.choice === "narrow" && draft.assessment.alternative) {
    outcomeStatement = draft.assessment.alternative.outcomeStatement;
    horizonWeeks = draft.assessment.alternative.horizonWeeks;
  }

  const { data: goal, error: goalError } = await db
    .from("goals")
    .insert({
      user_id: user.id,
      raw_input: draft.rawInput,
      title: draft.clarify.title,
      outcome_statement: outcomeStatement,
      domain: draft.clarify.domain,
      target_date: targetDate,
      horizon_weeks: horizonWeeks,
      status: "active",
      started_on: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (goalError || !goal) throw new Error(goalError?.message ?? "Failed to create goal");

  await db.from("goal_intake").insert({
    goal_id: goal.id,
    user_id: user.id,
    questions: draft.clarify.questions,
    answers: draft.answers,
    completed_at: new Date().toISOString(),
  });

  await db.from("feasibility_assessments").insert({
    goal_id: goal.id,
    user_id: user.id,
    verdict: draft.assessment.verdict,
    confidence: draft.assessment.confidence,
    rationale: draft.assessment.rationale,
    key_risks: draft.assessment.keyRisks,
    comparable_basis: draft.assessment.comparableBasis,
    alternative: draft.assessment.alternative,
  });

  const store = await cookies();
  store.delete(draftCookie.name);

  const goalId = goal.id as string;
  await decomposeGoal(db, goalId, user.id);

  redirect(`/goals/${goalId}/map`);
}
