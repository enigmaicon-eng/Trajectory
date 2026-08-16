import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { criticalPath, CycleError } from "@/lib/domain/graph";
import type { GraphEdge, GraphNode } from "@/lib/domain/types";
import { computeMilestoneRisk, type MilestoneRiskResult } from "@/lib/domain/signals";
import { todayISO } from "@/lib/domain/dates";
import type { Database } from "@/lib/db/types.generated";
import { GenerateNowButton } from "@/components/goal/GenerateNowButton";
import { buttonClass } from "@/components/ui/button-styles";

type NodeHealth = Database["public"]["Enums"]["node_health"];
type SignalField = { value: number | string; basis: string; caveat?: string | null } | { caveat: string };

function hasValue(field: SignalField | undefined): field is { value: number | string; basis: string; caveat?: string | null } {
  return !!field && "value" in field;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const RISK_LABEL: Record<NodeHealth, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
  unknown: "Not enough data",
};

function RiskBadge({ risk }: { risk: NodeHealth }) {
  return (
    <span className="rounded-full border border-neutral-400 px-2 py-0.5 text-xs uppercase tracking-wide text-neutral-700">
      {RISK_LABEL[risk]}
    </span>
  );
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
    .select("id, title, outcome_statement, status, horizon_weeks, target_date")
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
    .order("sequence", { ascending: true });
  const nodes = nodeRows ?? [];
  const milestones = nodes.filter((n) => n.kind === "milestone");

  const { data: edgeRows } = await db
    .from("node_dependencies")
    .select("from_node_id, to_node_id, type")
    .eq("goal_id", goalId);
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

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-10 px-6 py-16">
      <div>
        <nav aria-label="Goal" className="flex flex-wrap gap-4 text-sm text-neutral-500">
          <a href={`/goals/${goalId}/today`} className="underline">
            Today
          </a>
          <a href={`/goals/${goalId}/week`} className="underline">
            This week
          </a>
          <a href={`/goals/${goalId}/map`} className="underline">
            Goal map
          </a>
          <a href={`/goals/${goalId}/reflect`} className="underline">
            Reflect
          </a>
          <a href={`/goals/${goalId}/history`} className="underline">
            History
          </a>
        </nav>
        <h1 className="mt-2 text-xl font-medium">{goal.title}</h1>
        <p className="mt-1 text-neutral-600">{goal.outcome_statement}</p>
        <span className="mt-2 inline-block text-xs uppercase tracking-wide text-neutral-500">{goal.status}</span>
      </div>

      <section aria-labelledby="signals-heading" className="flex flex-col gap-4">
        <h2 id="signals-heading" className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Signals
        </h2>
        {!signalsRow ? (
          <p className="text-sm text-neutral-600">
            Not enough data yet — signals appear after a few days of activity on this goal.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            {(
              [
                ["Momentum", explanation?.momentum, (v: number | string) => formatPercent(v as number)],
                ["Execution rate", explanation?.executionRate, (v: number | string) => formatPercent(v as number)],
                ["Plan confidence", explanation?.planConfidence, (v: number | string) => formatPercent(v as number)],
                ["Risk", explanation?.riskLevel, (v: number | string) => RISK_LABEL[v as NodeHealth] ?? String(v)],
                [
                  "Projected completion",
                  explanation?.projectedCompletion,
                  (v: number | string) => String(v),
                ],
              ] as const
            ).map(([label, field, format]) => (
              <div key={label}>
                <dt className="text-sm text-neutral-500">{label}</dt>
                {hasValue(field) ? (
                  <>
                    <dd className="font-medium tabular-nums">{format(field.value)}</dd>
                    <p className="mt-0.5 text-xs text-neutral-500">{field.basis}</p>
                  </>
                ) : (
                  <dd className="text-sm text-neutral-500">{field?.caveat ?? "Not enough data"}</dd>
                )}
              </div>
            ))}
          </dl>
        )}
      </section>

      <section aria-labelledby="milestones-heading" className="flex flex-col gap-4">
        <h2 id="milestones-heading" className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Milestone timeline
        </h2>
        {nodes.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-neutral-600">
              This goal doesn&apos;t have a plan yet — generation may have been interrupted (often a temporary
              generation limit).
            </p>
            <GenerateNowButton goalId={goalId} />
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {milestones.map((m) => {
              const risk = milestoneRisks.get(m.id);
              const isCritical = criticalNodeIds.has(m.id);
              return (
                <li
                  key={m.id}
                  className={`rounded-md border p-4 ${isCritical ? "border-l-4 border-neutral-900" : "border-neutral-200"}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{m.title}</span>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      {isCritical && (
                        <span className="rounded-full border border-neutral-400 px-2 py-0.5 uppercase tracking-wide text-neutral-700">
                          Critical path
                        </span>
                      )}
                      {risk && <RiskBadge risk={risk.risk} />}
                      {m.target_date && <span>{m.target_date}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="next-heading" className="flex flex-col gap-4">
        <h2 id="next-heading" className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Next action
        </h2>
        <a href={`/goals/${goalId}/today`} className={buttonClass("primary")}>
          Go to today
        </a>
      </section>
    </main>
  );
}
