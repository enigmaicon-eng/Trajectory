// Pure, dependency-free goal-graph engine (§2.2, §5.1). No I/O, no framework
// imports — every function here must be unit-testable in isolation.
//
// Only `blocks` edges participate in cycle detection, topological order, and
// critical-path/slack computation, mirroring the DB's acyclicity trigger
// (which is `blocks`-only). `informs` edges are informational and never
// constrain scheduling.

import type { GraphEdge, GraphNode } from "./types";

export class CycleError extends Error {
  constructor(public readonly edge: GraphEdge) {
    super(`dependency cycle introduced by edge ${edge.fromNodeId} -> ${edge.toNodeId}`);
    this.name = "CycleError";
  }
}

function blocksEdges(edges: GraphEdge[]): GraphEdge[] {
  return edges.filter((e) => e.type === "blocks");
}

function adjacency(nodes: GraphNode[], edges: GraphEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    const list = adj.get(e.fromNodeId);
    if (list) list.push(e.toNodeId);
  }
  return adj;
}

/**
 * Returns the first `blocks` edge (in input order) that closes a cycle, or
 * null if the `blocks` subgraph is acyclic. Deterministic given a fixed edge
 * order, so callers can repair by dropping exactly that edge and re-checking.
 */
export function detectCycleEdge(nodes: GraphNode[], edges: GraphEdge[]): GraphEdge | null {
  const blocks = blocksEdges(edges);

  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  for (const n of nodes) color.set(n.id, WHITE);

  let cyclicEdge: GraphEdge | null = null;

  function visit(nodeId: string) {
    if (cyclicEdge) return;
    color.set(nodeId, GRAY);
    for (const edge of blocks) {
      if (cyclicEdge) return;
      if (edge.fromNodeId !== nodeId) continue;
      const target = edge.toNodeId;
      const c = color.get(target);
      if (c === GRAY) {
        cyclicEdge = edge;
        return;
      }
      if (c === WHITE) {
        visit(target);
      }
    }
    color.set(nodeId, BLACK);
  }

  for (const n of nodes) {
    if (cyclicEdge) break;
    if (color.get(n.id) === WHITE) visit(n.id);
  }

  return cyclicEdge;
}

export function isAcyclic(nodes: GraphNode[], edges: GraphEdge[]): boolean {
  return detectCycleEdge(nodes, edges) === null;
}

/**
 * Removes edges (one at a time, re-detecting after each removal) until the
 * `blocks` subgraph is acyclic. Returns the surviving edge list and the
 * dropped edges, for logging/repair-audit purposes.
 */
export function breakCycles(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { edges: GraphEdge[]; dropped: GraphEdge[] } {
  let current = edges;
  const dropped: GraphEdge[] = [];
  let cyclic = detectCycleEdge(nodes, current);
  while (cyclic) {
    const toDrop = cyclic;
    dropped.push(toDrop);
    current = current.filter((e) => e !== toDrop);
    cyclic = detectCycleEdge(nodes, current);
  }
  return { edges: current, dropped };
}

/**
 * Kahn's-algorithm topological sort over `blocks` edges. Throws CycleError if
 * the graph is cyclic — callers must run breakCycles()/isAcyclic() first.
 */
export function topoSort(nodes: GraphNode[], edges: GraphEdge[]): string[] {
  const blocks = blocksEdges(edges);
  const inDegree = new Map<string, number>();
  for (const n of nodes) inDegree.set(n.id, 0);
  for (const e of blocks) {
    inDegree.set(e.toNodeId, (inDegree.get(e.toNodeId) ?? 0) + 1);
  }

  const adj = adjacency(nodes, blocks);
  const queue: string[] = [];
  for (const n of nodes) if (inDegree.get(n.id) === 0) queue.push(n.id);
  queue.sort(); // deterministic order among ties

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    const next = [...(adj.get(id) ?? [])].sort();
    for (const target of next) {
      const deg = (inDegree.get(target) ?? 0) - 1;
      inDegree.set(target, deg);
      if (deg === 0) queue.push(target);
    }
    queue.sort();
  }

  if (order.length !== nodes.length) {
    const cyclic = detectCycleEdge(nodes, edges);
    throw cyclic
      ? new CycleError(cyclic)
      : new Error("topoSort: graph has nodes unreachable by topological order");
  }

  return order;
}

function duration(node: GraphNode): number {
  return node.kind === "project" ? (node.estimatedMinutes ?? 0) : 0;
}

export interface CriticalPathResult {
  /** Topological order used for the CPM forward/backward pass. */
  order: string[];
  earliestStart: Record<string, number>;
  earliestFinish: Record<string, number>;
  latestStart: Record<string, number>;
  latestFinish: Record<string, number>;
  /** latestStart - earliestStart, in minutes. 0 means on the critical path. */
  slack: Record<string, number>;
  criticalNodeIds: Set<string>;
  /** Total duration (minutes) of the longest dependency chain. */
  projectLengthMinutes: number;
}

/**
 * Classic CPM forward/backward pass over `blocks` edges, weighted by each
 * project's estimated_minutes (milestones are zero-duration checkpoints).
 * Throws CycleError on a cyclic graph — repair with breakCycles() first.
 */
export function criticalPath(nodes: GraphNode[], edges: GraphEdge[]): CriticalPathResult {
  const order = topoSort(nodes, edges);
  const blocks = blocksEdges(edges);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  for (const n of nodes) {
    predecessors.set(n.id, []);
    successors.set(n.id, []);
  }
  for (const e of blocks) {
    predecessors.get(e.toNodeId)?.push(e.fromNodeId);
    successors.get(e.fromNodeId)?.push(e.toNodeId);
  }

  const earliestStart: Record<string, number> = {};
  const earliestFinish: Record<string, number> = {};

  for (const id of order) {
    const preds = predecessors.get(id) ?? [];
    const es = preds.length === 0 ? 0 : Math.max(...preds.map((p) => earliestFinish[p]));
    earliestStart[id] = es;
    earliestFinish[id] = es + duration(byId.get(id) as GraphNode);
  }

  const projectLengthMinutes =
    order.length === 0 ? 0 : Math.max(...order.map((id) => earliestFinish[id]));

  const latestStart: Record<string, number> = {};
  const latestFinish: Record<string, number> = {};

  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const succs = successors.get(id) ?? [];
    const lf = succs.length === 0 ? projectLengthMinutes : Math.min(...succs.map((s) => latestStart[s]));
    latestFinish[id] = lf;
    latestStart[id] = lf - duration(byId.get(id) as GraphNode);
  }

  const slack: Record<string, number> = {};
  const criticalNodeIds = new Set<string>();
  for (const id of order) {
    const s = latestStart[id] - earliestStart[id];
    slack[id] = s;
    if (s === 0) criticalNodeIds.add(id);
  }

  return {
    order,
    earliestStart,
    earliestFinish,
    latestStart,
    latestFinish,
    slack,
    criticalNodeIds,
    projectLengthMinutes,
  };
}

/**
 * Nodes whose every `blocks` predecessor is already in `completedIds` — i.e.
 * nodes that could start right now. Used by plan generation (§5.2 `plan_week`)
 * to ground the AI call in what's actually actionable, and by replanning to
 * re-evaluate readiness after a graph edit.
 */
export function readyNodes(nodes: GraphNode[], edges: GraphEdge[], completedIds: Set<string>): string[] {
  const predecessors = new Map<string, string[]>();
  for (const n of nodes) predecessors.set(n.id, []);
  for (const e of blocksEdges(edges)) {
    predecessors.get(e.toNodeId)?.push(e.fromNodeId);
  }
  return nodes
    .filter((n) => !completedIds.has(n.id))
    .filter((n) => (predecessors.get(n.id) ?? []).every((p) => completedIds.has(p)))
    .map((n) => n.id);
}
