import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { criticalPath, CycleError } from "@/lib/domain/graph";
import type { GraphEdge, GraphNode } from "@/lib/domain/types";
import { computeMilestoneRisk, type MilestoneRiskResult } from "@/lib/domain/signals";
import { todayISO } from "@/lib/domain/dates";
import type { Database } from "@/lib/db/types.generated";
import { GenerateNowButton } from "@/components/goal/GenerateNowButton";
import { buttonClass } from "@/components/ui/button-styles";
import { StandingAnswer } from "@/components/ui/StandingAnswer";
import { HealthMark } from "@/components/ui/HealthMark";
import { formatMinutes, formatPercent, formatDateHuman } from "@/lib/format";

type NodeHealth = Database["public"]["Enums"]["node_health"];
type SignalField = { value: number | string; basis: string; caveat?: string | null } | { caveat: string };

function hasValue(field: SignalField | undefined): field is { value: number | string; basis: string; caveat?: string | null } {
  return !!field && "value" in field;
}

export default async function GoalOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: goalId } = await params;
  const db = await createClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(`/goals/${goalId}`)}`);

  const { data: goal } = await db
    .from("goals")
    .select("id, title, outcome_statement, status, horizon_weeks, target_date, started_on")
    .eq("id", goalId)
    .maybeSingle();
  if (!goal) notFound();

  const { data: signalsRow } = await db
    .from("goal_signals")
    .select("captured_on, momentum, execution_rate, plan_confidence, risk_level, projected_completion_date, explanation")
    .eq("goal_id", goalId)
    .order("captured_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  const explanation = (signalsRow?.explanation ?? null) as Record<string, SignalField> | null;

  const { data: nodeRows } = await db
    .from("goal_nodes")
    .select("id, kind, parent_id, title, target_date, sequence, status, estimated_minutes")
    .eq("goal_id", goalId)
    .neq("status", "dropped")
    .order("sequence", { ascending: true });
  const nodes = nodeRows ?? [];
  const milestones = nodes.filter((n) => n.kind === "milestone");
  const projects = nodes.filter((n) => n.kind === "project");

  const { data: edgeRows } = await db
    .from("node_dependencies")
    .select("from_node_id, to_node_id, type")
    .eq("goal_id", goalId)
    .is("removed_at", null);
  const edges = edgeRows ?? [];

  const { data: capacityRow } = await db
    .from("capacity_profiles")
    .select("ideal_minutes, days_per_week")
    .eq("goal_id", goalId)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  const capacity = { idealMinutes: capacityRow?.ideal_minutes ?? 60, daysPerWeek: capacityRow?.days_per_week ?? 5 };

  let criticalNodeIds = new Set<string>();
  if (nodes.length > 0) {
    const graphNodes: GraphNode[] = nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      parentId: n.parent_id,
      estimatedMinutes: n.estimated_minutes,
    }));
    const graphEdges: GraphEdge[] = edges.map((e) => ({ fromNodeId: e.from_node_id, toNodeId: e.to_node_id, type: e.type }));
    try {
      criticalNodeIds = criticalPath(graphNodes, graphEdges).criticalNodeIds;
    } catch (err) {
      if (!(err instanceof CycleError)) throw err;
    }
  }

  const today = todayISO();
  const milestoneRisks = new Map<string, MilestoneRiskResult>(
    milestones.map((m) => {
      const remainingMinutes = nodes
        .filter((p) => p.kind === "project" && p.parent_id === m.id && p.status !== "complete")
        .reduce((sum, p) => sum + (p.estimated_minutes ?? 0), 0);
      const risk = computeMilestoneRisk(
        { nodeId: m.id, targetDate: m.target_date, remainingMinutes, onCriticalPath: criticalNodeIds.has(m.id) },
        today,
        capacity,
      );
      return [m.id, risk];
    }),
  );

  const totalProjectMinutes = projects.reduce((sum, p) => sum + (p.estimated_minutes ?? 0), 0);
  const completedProjectMinutes = projects
    .filter((p) => p.status === "complete")
    .reduce((sum, p) => sum + (p.estimated_minutes ?? 0), 0);
  const workDonePct = totalProjectMinutes > 0 ? completedProjectMinutes / totalProjectMinutes : 0;
  const milestonesComplete = milestones.filter((m) => m.status === "complete").length;

  const bottleneckNode = nodes.find(
    (n) => n.kind === "project" && criticalNodeIds.has(n.id) && n.status !== "complete",
  );

  let standingLine1: string;
  if (nodes.length === 0) {
    standingLine1 = "Nothing is complete yet — the roadmap is still being built.";
  } else if (signalsRow?.projected_completion_date) {
    const target = goal.target_date;
    const projected = signalsRow.projected_completion_date;
    const onTime = target ? projected <= target : true;
    standingLine1 = `${formatPercent(workDonePct)} of the work is done. ${
      onTime ? `On pace for ${formatDateHuman(projected)}.` : `Projected for ${formatDateHuman(projected)}, past your ${formatDateHuman(target as string)} target.`
    }`;
  } else {
    standingLine1 = `${formatPercent(workDonePct)} of the work is done.`;
  }

  const { data: recentEvidenceRows } = await db
    .from("evidence")
    .select("id, task_id, kind, url, created_at")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: false })
    .limit(20);
  const evidenceByTaskId = new Map<string, { kind: string; url: string | null }>();
  for (const ev of recentEvidenceRows ?? []) {
    if (ev.task_id && !evidenceByTaskId.has(ev.task_id)) evidenceByTaskId.set(ev.task_id, { kind: ev.kind, url: ev.url });
  }

  const { data: recentTasks } = await db
    .from("tasks")
    .select("id, title, effort_minutes, completed_at")
    .eq("goal_id", goalId)
    .eq("status", "done")
    .order("completed_at", { ascending: false })
    .limit(8);

  const SIGNAL_ROWS = [
    ["Execution rate", explanation?.executionRate, (v: number | string) => formatPercent(v as number)],
    ["Momentum", explanation?.momentum, (v: number | string) => `${v}`],
    ["Plan confidence", explanation?.planConfidence, (v: number | string) => formatPercent(v as number)],
    ["Risk", explanation?.riskLevel, (v: number | string) => v as string],
    ["Projected finish", explanation?.projectedCompletion, (v: number | string) => formatDateHuman(v as string)],
  ] as const;

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-2xl flex-col gap-10 px-6 py-16">
      <StandingAnswer line1={standingLine1} />

      <section aria-labelledby="outcomes-heading" className="flex flex-col gap-3">
        <h2 id="outcomes-heading" className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">
          Outcomes
        </h2>
        {milestones.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Nothing is complete yet — the roadmap is still being built.
          </p>
        ) : (
          <>
            <p className="text-sm text-ink">
              {milestonesComplete} of {milestones.length} milestones complete
            </p>
            <div className="h-1.5 w-full rounded-full bg-rule" role="img" aria-label={`${formatPercent(workDonePct)} of work complete`}>
              <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.round(workDonePct * 100)}%` }} />
            </div>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-muted">
              {milestones.map((m, i) => {
                const risk = milestoneRisks.get(m.id);
                return (
                  <span key={m.id} className="inline-flex items-center gap-1.5">
                    {m.title}
                    {risk && <HealthMark health={m.status === "complete" ? ("on_track" as NodeHealth) : risk.risk} />}
                    {i < milestones.length - 1 && <span aria-hidden="true">·</span>}
                  </span>
                );
              })}
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="signals-heading" className="flex flex-col gap-3">
        <h2 id="signals-heading" className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">
          How it&apos;s going
        </h2>
        {!signalsRow ? (
          <p className="text-sm text-ink-muted">
            Not enough data yet. After seven days of execution, these become meaningful.
          </p>
        ) : (
          <dl className="flex flex-col">
            {SIGNAL_ROWS.map(([label, field, format]) => (
              <div key={label} className="flex items-center justify-between gap-4 border-b border-rule py-2 last:border-b-0">
                <dt className="text-sm text-ink-muted">{label}</dt>
                {hasValue(field) ? (
                  <details className="group text-right">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm">
                      <span className="font-medium tabular-nums text-ink">{format(field.value)}</span>
                      <span aria-hidden="true" className="text-ink-faint">
                        ⓘ
                      </span>
                    </summary>
                    <p className="mt-1 max-w-xs text-xs text-ink-muted">{field.basis}</p>
                    {field.caveat && <p className="text-xs text-ink-faint">{field.caveat}</p>}
                  </details>
                ) : (
                  <dd className="text-sm text-ink-faint">{field?.caveat ?? "not enough data"}</dd>
                )}
              </div>
            ))}
          </dl>
        )}
      </section>

      {bottleneckNode && (
        <section aria-labelledby="bottleneck-heading" className="flex flex-col gap-2 border-t border-rule pt-6">
          <h2 id="bottleneck-heading" className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">
            The bottleneck
          </h2>
          <p className="text-sm text-ink">{bottleneckNode.title} is on the critical path and not yet done.</p>
          <Link href={`/goals/${goalId}/today`} className={`self-start ${buttonClass("secondary", "small")}`}>
            Open in Today
          </Link>
        </section>
      )}

      {(recentTasks ?? []).length > 0 && (
        <section aria-labelledby="record-heading" className="flex flex-col gap-3 border-t border-rule pt-6">
          <h2 id="record-heading" className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">
            What you&apos;ve done
          </h2>
          <ul className="flex flex-col gap-2">
            {(recentTasks ?? []).map((t) => {
              const ev = evidenceByTaskId.get(t.id);
              return (
                <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="text-ink-muted">
                    {t.completed_at ? formatDateHuman(t.completed_at.slice(0, 10)) : ""}{" "}
                    <span className="text-ink">{t.title}</span>
                  </span>
                  <span className="flex items-center gap-2 tabular-nums text-ink-muted">
                    {formatMinutes(t.effort_minutes)} est
                    {ev?.url && (
                      <a href={ev.url} target="_blank" rel="noreferrer" className="text-accent underline decoration-rule underline-offset-2">
                        ↗ link
                      </a>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {nodes.length === 0 && (
        <div className="flex flex-col gap-3">
          <GenerateNowButton goalId={goalId} />
        </div>
      )}

      <Link href={`/goals/${goalId}/today`} className={buttonClass("primary")}>
        Go to today
      </Link>
    </main>
  );
}
