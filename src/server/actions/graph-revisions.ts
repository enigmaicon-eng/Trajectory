import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/types.generated";

type DB = SupabaseClient<Database>;

/**
 * Persists an immutable snapshot of the live graph (non-dropped nodes,
 * non-removed edges) as the next revision for the goal. Called after any
 * operation that mutates goal_nodes/node_dependencies, so a superseded plan
 * can render the graph exactly as it stood when it was generated (§3.2
 * GraphRevision; §4.2 v2 append-only graph).
 */
export async function snapshotGraphRevision(
  db: DB,
  goalId: string,
  userId: string,
  reason: "initial" | "replan" | "manual_edit",
  replanEventId?: string,
): Promise<void> {
  const { data: nodeRows, error: nodesError } = await db
    .from("goal_nodes")
    .select("id, kind, parent_id, title, status, target_date, estimated_minutes")
    .eq("goal_id", goalId);
  if (nodesError) throw new Error(`Failed to read graph for snapshot: ${nodesError.message}`);

  const { data: edgeRows, error: edgesError } = await db
    .from("node_dependencies")
    .select("from_node_id, to_node_id, type")
    .eq("goal_id", goalId)
    .is("removed_at", null);
  if (edgesError) throw new Error(`Failed to read dependencies for snapshot: ${edgesError.message}`);

  const { data: latest, error: latestError } = await db
    .from("graph_revisions")
    .select("revision")
    .eq("goal_id", goalId)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw new Error(`Failed to read prior graph revision: ${latestError.message}`);
  const revision = (latest?.revision ?? 0) + 1;

  const snapshot = {
    nodes: (nodeRows ?? []).map((n) => ({
      id: n.id,
      kind: n.kind,
      parentId: n.parent_id,
      title: n.title,
      status: n.status,
      targetDate: n.target_date,
      estimatedMinutes: n.estimated_minutes,
    })),
    edges: (edgeRows ?? []).map((e) => ({
      fromNodeId: e.from_node_id,
      toNodeId: e.to_node_id,
      type: e.type,
    })),
  };

  const { error } = await db.from("graph_revisions").insert({
    goal_id: goalId,
    user_id: userId,
    revision,
    snapshot: snapshot as unknown as Json,
    reason,
    replan_event_id: replanEventId ?? null,
  });
  if (error) throw new Error(`Failed to persist graph revision: ${error.message}`);
}
