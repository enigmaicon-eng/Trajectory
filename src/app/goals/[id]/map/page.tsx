import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { criticalPath, CycleError } from "@/lib/domain/graph";
import type { GraphEdge, GraphNode } from "@/lib/domain/types";

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h`;
}

export default async function GoalMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: goalId } = await params;
  const db = await createClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(`/goals/${goalId}/map`)}`);

  const { data: goal } = await db
    .from("goals")
    .select("id, title, outcome_statement, status, horizon_weeks")
    .eq("id", goalId)
    .maybeSingle();
  if (!goal) notFound();

  const { data: nodeRows } = await db
    .from("goal_nodes")
    .select("id, kind, parent_id, title, summary, verification, sequence, target_date, estimated_minutes")
    .eq("goal_id", goalId)
    .order("sequence", { ascending: true });

  const { data: edgeRows } = await db
    .from("node_dependencies")
    .select("from_node_id, to_node_id, type, rationale")
    .eq("goal_id", goalId);

  const nodes = nodeRows ?? [];
  const edges = edgeRows ?? [];

  const milestones = nodes.filter((n) => n.kind === "milestone").sort((a, b) => a.sequence - b.sequence);
  const projectsByMilestone = new Map<string, typeof nodes>();
  for (const n of nodes) {
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

  const titleById = new Map(nodes.map((n) => [n.id, n.title]));
  const blockedByOf = new Map<string, string[]>(); // node -> nodes it depends on (must finish first)
  const blocksOf = new Map<string, string[]>(); // node -> nodes waiting on it
  for (const e of edges) {
    if (e.type !== "blocks") continue;
    appendTo(blockedByOf, e.to_node_id, e.from_node_id);
    appendTo(blocksOf, e.from_node_id, e.to_node_id);
  }

  let criticalNodeIds = new Set<string>();
  let criticalPathMinutes = 0;
  let cycleDetected = false;
  if (nodes.length > 0) {
    const graphNodes: GraphNode[] = nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      parentId: n.parent_id,
      estimatedMinutes: n.estimated_minutes,
    }));
    const graphEdges: GraphEdge[] = edges.map((e) => ({
      fromNodeId: e.from_node_id,
      toNodeId: e.to_node_id,
      type: e.type,
    }));
    try {
      const result = criticalPath(graphNodes, graphEdges);
      criticalNodeIds = result.criticalNodeIds;
      criticalPathMinutes = result.projectLengthMinutes;
    } catch (err) {
      // Defensive only — decompose breaks cycles before persisting. A cycle
      // here would mean a later manual edit reintroduced one; degrade to an
      // unhighlighted graph rather than a broken page.
      if (err instanceof CycleError) cycleDetected = true;
      else throw err;
    }
  }

  const totalProjectMinutes = nodes
    .filter((n) => n.kind === "project")
    .reduce((sum, n) => sum + (n.estimated_minutes ?? 0), 0);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <div>
        <a href="/goals" className="text-sm text-neutral-500 underline">
          ← Your goals
        </a>
        <h1 className="mt-2 text-xl font-medium">{goal.title}</h1>
        <p className="mt-1 text-neutral-600">{goal.outcome_statement}</p>
      </div>

      {nodes.length === 0 ? (
        <p className="text-sm text-neutral-600">
          This goal doesn&apos;t have a graph yet. That shouldn&apos;t normally happen — try creating a new
          goal.
        </p>
      ) : (
        <>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 border-b border-neutral-200 pb-6 text-sm">
            <div>
              <dt className="text-neutral-500">Milestones</dt>
              <dd className="font-medium tabular-nums">{milestones.length}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Projects</dt>
              <dd className="font-medium tabular-nums">{nodes.length - milestones.length}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Total estimated effort</dt>
              <dd className="font-medium tabular-nums">{formatMinutes(totalProjectMinutes)}</dd>
            </div>
            {!cycleDetected && criticalPathMinutes > 0 && (
              <div>
                <dt className="text-neutral-500">Critical path length</dt>
                <dd className="font-medium tabular-nums">{formatMinutes(criticalPathMinutes)}</dd>
              </div>
            )}
          </dl>

          <ol className="flex flex-col gap-6">
            {milestones.map((m) => {
              const projects = projectsByMilestone.get(m.id) ?? [];
              const isCritical = criticalNodeIds.has(m.id);
              return (
                <li
                  key={m.id}
                  className={`rounded-md border p-4 ${
                    isCritical ? "border-l-4 border-neutral-900" : "border-neutral-200"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-medium">{m.title}</h2>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-500">
                      {isCritical && (
                        <span className="rounded-full border border-neutral-400 px-2 py-0.5 text-neutral-700">
                          Critical path
                        </span>
                      )}
                      {m.target_date && <span>{m.target_date}</span>}
                    </div>
                  </div>
                  {m.summary && <p className="mt-1 text-sm text-neutral-600">{m.summary}</p>}
                  <p className="mt-2 text-xs text-neutral-500">
                    <span className="font-medium text-neutral-700">Verification: </span>
                    {m.verification}
                  </p>

                  {projects.length > 0 && (
                    <ul className="mt-4 flex flex-col gap-3 border-t border-neutral-100 pt-4">
                      {projects.map((p) => {
                        const projectIsCritical = criticalNodeIds.has(p.id);
                        const dependsOn = (blockedByOf.get(p.id) ?? [])
                          .map((depId) => titleById.get(depId))
                          .filter((t): t is string => Boolean(t));
                        const blocksNext = (blocksOf.get(p.id) ?? [])
                          .map((depId) => titleById.get(depId))
                          .filter((t): t is string => Boolean(t));
                        return (
                          <li
                            key={p.id}
                            className={`rounded-md p-3 text-sm ${
                              projectIsCritical ? "bg-neutral-100" : "bg-neutral-50"
                            }`}
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="font-medium">{p.title}</span>
                              <span className="flex items-center gap-2 text-xs text-neutral-500">
                                {projectIsCritical && (
                                  <span className="rounded-full border border-neutral-400 px-2 py-0.5 uppercase tracking-wide text-neutral-700">
                                    Critical path
                                  </span>
                                )}
                                <span className="tabular-nums">
                                  {formatMinutes(p.estimated_minutes ?? 0)}
                                </span>
                              </span>
                            </div>
                            {p.summary && <p className="mt-1 text-neutral-600">{p.summary}</p>}
                            <p className="mt-1 text-xs text-neutral-500">
                              <span className="font-medium text-neutral-700">Verification: </span>
                              {p.verification}
                            </p>
                            {dependsOn.length > 0 && (
                              <p className="mt-1 text-xs text-neutral-500">
                                <span className="font-medium text-neutral-700">Depends on: </span>
                                {dependsOn.join(", ")}
                              </p>
                            )}
                            {blocksNext.length > 0 && (
                              <p className="mt-1 text-xs text-neutral-500">
                                <span className="font-medium text-neutral-700">Blocks: </span>
                                {blocksNext.join(", ")}
                              </p>
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
        </>
      )}
    </main>
  );
}
