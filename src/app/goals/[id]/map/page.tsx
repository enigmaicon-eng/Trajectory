import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { criticalPath, CycleError } from "@/lib/domain/graph";
import type { GraphEdge, GraphNode } from "@/lib/domain/types";
import { computeMilestoneRisk } from "@/lib/domain/signals";
import { todayISO } from "@/lib/domain/dates";
import { GenerateNowButton } from "@/components/goal/GenerateNowButton";
import { StandingAnswer } from "@/components/ui/StandingAnswer";
import { HealthMark, StatusMark } from "@/components/ui/HealthMark";
import { formatMinutes, confidenceLabel } from "@/lib/format";

export default async function GoalMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: goalId } = await params;
  const db = await createClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(`/goals/${goalId}/map`)}`);

  const { data: goal } = await db
    .from("goals")
    .select("id, title, outcome_statement, status, horizon_weeks, target_date")
    .eq("id", goalId)
    .maybeSingle();
  if (!goal) notFound();

  const { data: assessment } = await db
    .from("feasibility_assessments")
    .select("confidence, verdict")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: nodeRows } = await db
    .from("goal_nodes")
    .select("id, kind, parent_id, title, summary, verification, sequence, target_date, estimated_minutes, status, dropped_reason")
    .eq("goal_id", goalId)
    .order("sequence", { ascending: true });

  const { data: edgeRows } = await db
    .from("node_dependencies")
    .select("from_node_id, to_node_id, type, rationale")
    .eq("goal_id", goalId)
    .is("removed_at", null);

  const { data: capacityRow } = await db
    .from("capacity_profiles")
    .select("ideal_minutes, days_per_week")
    .eq("goal_id", goalId)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  const capacity = { idealMinutes: capacityRow?.ideal_minutes ?? 60, daysPerWeek: capacityRow?.days_per_week ?? 5 };

  const allNodes = nodeRows ?? [];
  const edges = edgeRows ?? [];
  const liveNodes = allNodes.filter((n) => n.status !== "dropped");
  const droppedNodes = allNodes.filter((n) => n.status === "dropped");

  const milestones = liveNodes.filter((n) => n.kind === "milestone").sort((a, b) => a.sequence - b.sequence);
  const projectsByMilestone = new Map<string, typeof liveNodes>();
  for (const n of liveNodes) {
    if (n.kind !== "project" || !n.parent_id) continue;
    const list = projectsByMilestone.get(n.parent_id) ?? [];
    list.push(n);
    projectsByMilestone.set(n.parent_id, list);
  }
  for (const list of projectsByMilestone.values()) list.sort((a, b) => a.sequence - b.sequence);

  function appendTo(map: Map<string, string[]>, key: string, value: string) {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  }

  const titleById = new Map(allNodes.map((n) => [n.id, n.title]));
  const blockedByOf = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type !== "blocks") continue;
    appendTo(blockedByOf, e.to_node_id, e.from_node_id);
  }

  let criticalNodeIds = new Set<string>();
  let criticalPathMinutes = 0;
  let cycleDetected = false;
  if (liveNodes.length > 0) {
    const graphNodes: GraphNode[] = liveNodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      parentId: n.parent_id,
      estimatedMinutes: n.estimated_minutes,
    }));
    const graphEdges: GraphEdge[] = edges
      .filter((e) => titleById.has(e.from_node_id) && titleById.has(e.to_node_id))
      .map((e) => ({ fromNodeId: e.from_node_id, toNodeId: e.to_node_id, type: e.type }));
    try {
      const result = criticalPath(graphNodes, graphEdges);
      criticalNodeIds = result.criticalNodeIds;
      criticalPathMinutes = result.projectLengthMinutes;
    } catch (err) {
      if (err instanceof CycleError) cycleDetected = true;
      else throw err;
    }
  }

  const today = todayISO();
  const milestoneRiskByCId = new Map(
    milestones.map((m) => {
      const remainingMinutes = liveNodes
        .filter((p) => p.kind === "project" && p.parent_id === m.id && p.status !== "complete")
        .reduce((sum, p) => sum + (p.estimated_minutes ?? 0), 0);
      return [
        m.id,
        computeMilestoneRisk(
          { nodeId: m.id, targetDate: m.target_date, remainingMinutes, onCriticalPath: criticalNodeIds.has(m.id) },
          today,
          capacity,
        ),
      ] as const;
    }),
  );

  const totalProjectMinutes = liveNodes
    .filter((n) => n.kind === "project")
    .reduce((sum, n) => sum + (n.estimated_minutes ?? 0), 0);

  const bottleneck = liveNodes.find(
    (n) => n.kind === "project" && criticalNodeIds.has(n.id) && n.status !== "complete",
  );
  const standingLine1 = bottleneck
    ? `Everything depends on finishing ${bottleneck.title}.`
    : milestones.length > 0
      ? `${milestones.length} milestone${milestones.length === 1 ? "" : "s"}, ${liveNodes.length - milestones.length} projects.`
      : "The roadmap is still being built.";

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <StandingAnswer line1={standingLine1} />

      <dl className="flex flex-col gap-3 text-sm">
        <div>
          <dt className="text-ink-muted">Outcome</dt>
          <dd className="text-ink">{goal.outcome_statement}</dd>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <dt className="text-ink-muted">Target date</dt>
            <dd className="font-medium text-ink">{goal.target_date ?? "not fixed"}</dd>
          </div>
          {assessment && (
            <div>
              <dt className="text-ink-muted">Confidence</dt>
              <dd className="font-medium text-ink">{confidenceLabel(assessment.confidence)}</dd>
            </div>
          )}
          <div>
            <dt className="text-ink-muted">Current focus</dt>
            <dd className="font-medium text-ink">{bottleneck?.title ?? "Nothing on the critical path yet"}</dd>
          </div>
        </div>
      </dl>

      {liveNodes.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            Generation may have been interrupted — this is usually a temporary limit, and nothing was lost.
          </p>
          <GenerateNowButton goalId={goalId} />
        </div>
      ) : (
        <>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 border-b border-rule pb-6 text-sm">
            <div>
              <dt className="text-ink-muted">Milestones</dt>
              <dd className="font-medium tabular-nums text-ink">{milestones.length}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Projects</dt>
              <dd className="font-medium tabular-nums text-ink">{liveNodes.length - milestones.length}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Total estimated effort</dt>
              <dd className="font-medium tabular-nums text-ink">{formatMinutes(totalProjectMinutes)}</dd>
            </div>
            {!cycleDetected && criticalPathMinutes > 0 && (
              <div>
                <dt className="text-ink-muted">Critical path length</dt>
                <dd className="font-medium tabular-nums text-ink">{formatMinutes(criticalPathMinutes)}</dd>
              </div>
            )}
          </dl>

          <ol className="flex flex-col gap-8">
            {milestones.map((m) => {
              const projects = projectsByMilestone.get(m.id) ?? [];
              const isCritical = criticalNodeIds.has(m.id);
              const risk = milestoneRiskByCId.get(m.id);
              return (
                <li key={m.id} className={isCritical ? "border-l-2 border-ink pl-4" : "pl-4"}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-base font-medium text-ink">
                      Milestone{m.sequence != null ? ` ${m.sequence + 1}` : ""} · {m.title}
                    </h2>
                    <div className="flex items-center gap-3 text-xs text-ink-muted">
                      {risk && <HealthMark health={risk.risk} />}
                      {m.target_date && <span>due {m.target_date}</span>}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    <span className="font-medium text-ink">Done when: </span>
                    {m.verification}
                  </p>
                  {isCritical && (
                    <p className="mt-1 text-xs text-ink-faint">This chain sets the finish date.</p>
                  )}

                  {projects.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2 border-t border-rule pt-3">
                      {projects.map((p) => {
                        const dependsOn = (blockedByOf.get(p.id) ?? [])
                          .map((depId) => titleById.get(depId))
                          .filter((t): t is string => Boolean(t));
                        return (
                          <li key={p.id} className="text-sm">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="flex items-center gap-2">
                                <StatusMark status={p.status} />
                                <span className="text-ink">{p.title}</span>
                              </span>
                              <span className="tabular-nums text-xs text-ink-muted">
                                {formatMinutes(p.estimated_minutes ?? 0)}
                              </span>
                            </div>
                            {dependsOn.length > 0 && (
                              <p className="pl-[1.6rem] text-xs text-ink-faint">waiting on: {dependsOn.join(", ")}</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>

          {droppedNodes.length > 0 && (
            <section className="border-t border-rule pt-6">
              <h2 className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">Dropped</h2>
              <ul className="mt-3 flex flex-col gap-1">
                {droppedNodes.map((n) => (
                  <li key={n.id} className="text-sm text-ink-faint">
                    <span className="line-through">{n.title}</span>
                    {n.dropped_reason && <span> — {n.dropped_reason}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <Link href={`/goals/${goalId}/week`} className="text-sm text-ink underline decoration-rule underline-offset-2 hover:text-accent">
        ← This week
      </Link>
    </main>
  );
}
