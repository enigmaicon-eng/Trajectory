// Domain types for the goal graph. Deliberately decoupled from
// Database["public"]["Tables"]["goal_nodes"]["Row"] so the pure engine in
// graph.ts/invariants.ts has zero dependency on generated DB types.

export type NodeKind = "milestone" | "project";
export type DependencyType = "blocks" | "informs";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  parentId: string | null;
  /** Projects only; milestones are zero-duration checkpoints. */
  estimatedMinutes: number | null;
}

export interface GraphEdge {
  /** For type="blocks": fromNodeId must complete before toNodeId can start (fromNodeId blocks toNodeId). */
  fromNodeId: string;
  toNodeId: string;
  type: DependencyType;
}
