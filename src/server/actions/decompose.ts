import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types.generated";
import { runDecompose } from "@/lib/ai/modules/decompose";
import type { DecomposeInput } from "@/lib/ai/modules/decompose/input.schema";
import { snapshotGraphRevision } from "@/server/actions/graph-revisions";

type DB = SupabaseClient<Database>;

// Phase 1 onboarding still has no dedicated capacity-intake UI, but the
// `assess` module now proposes a personalized ideal/normal/minimum-viable
// day from the goal's domain and the user's own stated constraints (see the
// 20260820090000 migration) — so the fallback below only fires when that
// proposal is missing (an assessment run before this shipped, or no
// assessment on record at all). A real capacity-intake surface can still
// supersede either by inserting a newer capacity_profiles row —
// effective-dated, per §3.2.
const DEFAULT_CAPACITY = {
  idealMinutes: 90,
  normalMinutes: 60,
  minimumMinutes: 20,
  daysPerWeek: 5,
} as const;

interface ProposedCapacityLike {
  idealMinutes: number;
  normalMinutes: number;
  minimumMinutes: number;
}

/** Defensive re-validation of a jsonb column — never trust stored AI output blindly. */
function parseProposedCapacity(value: unknown): ProposedCapacityLike | null {
  if (!value || typeof value !== "object") return null;
  const { idealMinutes, normalMinutes, minimumMinutes } = value as Record<string, unknown>;
  if (typeof idealMinutes !== "number" || typeof normalMinutes !== "number" || typeof minimumMinutes !== "number") {
    return null;
  }
  if (!(minimumMinutes <= normalMinutes && normalMinutes <= idealMinutes)) return null;
  return { idealMinutes, normalMinutes, minimumMinutes };
}

async function ensureCapacityProfile(
  db: DB,
  goalId: string,
  userId: string,
  effectiveFrom: string,
  proposedCapacity: ProposedCapacityLike | null,
): Promise<DecomposeInput["capacity"]> {
  const { data: existing, error: readError } = await db
    .from("capacity_profiles")
    .select("ideal_minutes, normal_minutes, minimum_minutes, days_per_week")
    .eq("goal_id", goalId)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) throw new Error(`Failed to read capacity profile: ${readError.message}`);

  if (existing) {
    return {
      idealMinutes: existing.ideal_minutes,
      normalMinutes: existing.normal_minutes,
      minimumMinutes: existing.minimum_minutes,
      daysPerWeek: existing.days_per_week,
    };
  }

  const seed = proposedCapacity ?? DEFAULT_CAPACITY;
  const { error: insertError } = await db.from("capacity_profiles").insert({
    goal_id: goalId,
    user_id: userId,
    effective_from: effectiveFrom,
    ideal_minutes: seed.idealMinutes,
    normal_minutes: seed.normalMinutes,
    minimum_minutes: seed.minimumMinutes,
    days_per_week: DEFAULT_CAPACITY.daysPerWeek,
    note: proposedCapacity ? "proposed by assess from the goal and stated constraints" : "default — no capacity proposal on record",
  });
  if (insertError) throw new Error(`Failed to create capacity profile: ${insertError.message}`);

  return { ...seed, daysPerWeek: DEFAULT_CAPACITY.daysPerWeek };
}

export interface DecomposeGoalResult {
  milestoneCount: number;
  projectCount: number;
  dependencyCount: number;
}

/**
 * Runs the `decompose` AI module for an existing, committed goal and
 * persists the resulting graph (goal_nodes + node_dependencies). Called
 * synchronously from commitGoal() right after the goal row is created.
 */
export async function decomposeGoal(db: DB, goalId: string, userId: string): Promise<DecomposeGoalResult> {
  const { data: goal, error: goalError } = await db
    .from("goals")
    .select("outcome_statement, domain, target_date, horizon_weeks")
    .eq("id", goalId)
    .single();
  if (goalError || !goal) throw new Error(goalError?.message ?? "Goal not found");

  // clarify's horizonWeeks inference is nullable (§5.2); fall back to the
  // gap to target_date, or a conservative default, rather than failing the
  // whole commit — the goal row already persisted by the time we get here.
  const horizonWeeks =
    goal.horizon_weeks ??
    (goal.target_date
      ? Math.max(1, Math.ceil((Date.parse(goal.target_date) - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
      : 12);

  const { data: assessment, error: assessmentError } = await db
    .from("feasibility_assessments")
    .select("verdict, rationale, proposed_capacity")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (assessmentError) throw new Error(assessmentError.message);

  const { data: constraintRows, error: constraintsError } = await db
    .from("constraints")
    .select("kind, label, is_hard")
    .eq("goal_id", goalId);
  if (constraintsError) throw new Error(constraintsError.message);

  const effectiveFrom = new Date().toISOString().slice(0, 10);
  const capacity = await ensureCapacityProfile(
    db,
    goalId,
    userId,
    effectiveFrom,
    parseProposedCapacity(assessment?.proposed_capacity),
  );

  const input: DecomposeInput = {
    outcomeStatement: goal.outcome_statement,
    domain: goal.domain ?? "other",
    targetDate: goal.target_date,
    horizonWeeks,
    feasibilityVerdict: assessment?.verdict ?? "ambitious_but_possible",
    feasibilityRationale: assessment?.rationale ?? "No assessment on record.",
    constraints: (constraintRows ?? []).map((c) => ({
      kind: c.kind,
      label: c.label,
      isHard: c.is_hard,
    })),
    capacity,
  };

  const output = await runDecompose(input, { userId, goalId, traceId: randomUUID(), db });

  const milestoneIdByTemp = new Map<string, string>();
  const milestoneRows = output.milestones.map((m) => {
    const id = randomUUID();
    milestoneIdByTemp.set(m.tempId, id);
    return {
      id,
      goal_id: goalId,
      user_id: userId,
      kind: "milestone" as const,
      parent_id: null,
      title: m.title,
      summary: m.summary,
      verification: m.verification,
      sequence: m.sequence,
      target_date: m.targetDate,
    };
  });

  const projectIdByTemp = new Map<string, string>();
  const projectRows = output.projects.map((p) => {
    const id = randomUUID();
    projectIdByTemp.set(p.tempId, id);
    const parentId = milestoneIdByTemp.get(p.milestoneTempId);
    if (!parentId) throw new Error(`decompose: project ${p.tempId} has no resolved milestone parent`);
    return {
      id,
      goal_id: goalId,
      user_id: userId,
      kind: "project" as const,
      parent_id: parentId,
      title: p.title,
      summary: p.summary,
      verification: p.verification,
      sequence: p.sequence,
      estimated_minutes: p.estimatedMinutes,
    };
  });

  const { error: nodesError } = await db.from("goal_nodes").insert([...milestoneRows, ...projectRows]);
  if (nodesError) throw new Error(`Failed to persist goal graph: ${nodesError.message}`);

  const idByTemp = new Map<string, string>([...milestoneIdByTemp, ...projectIdByTemp]);
  const dependencyRows = output.dependencies.map((d) => {
    const fromId = idByTemp.get(d.fromTempId);
    const toId = idByTemp.get(d.toTempId);
    if (!fromId || !toId) throw new Error("decompose: dependency references an unresolved node");
    return {
      goal_id: goalId,
      user_id: userId,
      from_node_id: fromId,
      to_node_id: toId,
      type: d.type,
      rationale: d.rationale,
    };
  });

  if (dependencyRows.length > 0) {
    const { error: depsError } = await db.from("node_dependencies").insert(dependencyRows);
    if (depsError) throw new Error(`Failed to persist goal dependencies: ${depsError.message}`);
  }

  await snapshotGraphRevision(db, goalId, userId, "initial");

  return {
    milestoneCount: milestoneRows.length,
    projectCount: projectRows.length,
    dependencyCount: dependencyRows.length,
  };
}
