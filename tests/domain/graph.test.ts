import { describe, expect, it } from "vitest";
import {
  breakCycles,
  criticalPath,
  CycleError,
  detectCycleEdge,
  isAcyclic,
  readyNodes,
  topoSort,
} from "@/lib/domain/graph";
import type { GraphEdge, GraphNode } from "@/lib/domain/types";

function milestone(id: string): GraphNode {
  return { id, kind: "milestone", parentId: null, estimatedMinutes: null };
}
function project(id: string, parentId: string, estimatedMinutes: number): GraphNode {
  return { id, kind: "project", parentId, estimatedMinutes };
}
function blocks(from: string, to: string): GraphEdge {
  return { fromNodeId: from, toNodeId: to, type: "blocks" };
}
function informs(from: string, to: string): GraphEdge {
  return { fromNodeId: from, toNodeId: to, type: "informs" };
}

describe("detectCycleEdge / isAcyclic", () => {
  it("returns null on an acyclic graph", () => {
    const nodes = [milestone("a"), milestone("b"), milestone("c")];
    const edges = [blocks("a", "b"), blocks("b", "c")];
    expect(detectCycleEdge(nodes, edges)).toBeNull();
    expect(isAcyclic(nodes, edges)).toBe(true);
  });

  it("detects a direct cycle (a->b->a)", () => {
    const nodes = [milestone("a"), milestone("b")];
    const edges = [blocks("a", "b"), blocks("b", "a")];
    const cyclic = detectCycleEdge(nodes, edges);
    expect(cyclic).not.toBeNull();
    expect(isAcyclic(nodes, edges)).toBe(false);
  });

  it("detects a longer cycle (a->b->c->a)", () => {
    const nodes = [milestone("a"), milestone("b"), milestone("c")];
    const edges = [blocks("a", "b"), blocks("b", "c"), blocks("c", "a")];
    expect(isAcyclic(nodes, edges)).toBe(false);
  });

  it("detects a self-loop as a cycle", () => {
    const nodes = [milestone("a")];
    const edges = [blocks("a", "a")];
    expect(isAcyclic(nodes, edges)).toBe(false);
  });

  it("ignores `informs` edges for cycle detection", () => {
    const nodes = [milestone("a"), milestone("b")];
    const edges = [informs("a", "b"), informs("b", "a")];
    expect(isAcyclic(nodes, edges)).toBe(true);
  });
});

describe("breakCycles", () => {
  it("leaves an already-acyclic graph untouched", () => {
    const nodes = [milestone("a"), milestone("b")];
    const edges = [blocks("a", "b")];
    const { edges: survivors, dropped } = breakCycles(nodes, edges);
    expect(survivors).toEqual(edges);
    expect(dropped).toEqual([]);
  });

  it("drops edges until the blocks subgraph is acyclic", () => {
    const nodes = [milestone("a"), milestone("b"), milestone("c")];
    const edges = [blocks("a", "b"), blocks("b", "c"), blocks("c", "a")];
    const { edges: survivors, dropped } = breakCycles(nodes, edges);
    expect(isAcyclic(nodes, survivors)).toBe(true);
    expect(dropped.length).toBeGreaterThan(0);
    expect(survivors.length + dropped.length).toBe(edges.length);
  });
});

describe("topoSort", () => {
  it("orders nodes respecting blocks dependencies", () => {
    const nodes = [milestone("c"), milestone("a"), milestone("b")];
    const edges = [blocks("a", "b"), blocks("b", "c")];
    const order = topoSort(nodes, edges);
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("c"));
    expect(order).toHaveLength(3);
  });

  it("throws CycleError on a cyclic graph", () => {
    const nodes = [milestone("a"), milestone("b")];
    const edges = [blocks("a", "b"), blocks("b", "a")];
    expect(() => topoSort(nodes, edges)).toThrow(CycleError);
  });
});

describe("criticalPath", () => {
  it("computes earliest/latest times, slack, and the critical path for a diamond graph", () => {
    // Convention: a "blocks" edge (fromNodeId -> toNodeId) means fromNodeId
    // must complete before toNodeId can start (matches GraphEdge's doc
    // comment and the decompose prompt). Diamond: m1 gates p1 (60m) and p2
    // (30m) in parallel, both of which gate m2.
    const nodes = [
      milestone("m1"),
      project("p1", "m1", 60),
      project("p2", "m1", 30),
      milestone("m2"),
    ];
    const edges: GraphEdge[] = [
      blocks("m1", "p1"), // m1 blocks p1
      blocks("m1", "p2"), // m1 blocks p2
      blocks("p1", "m2"), // p1 blocks m2
      blocks("p2", "m2"), // p2 blocks m2
    ];

    const result = criticalPath(nodes, edges);
    // Longest chain: m1(0) -> p1(60) -> m2(0) = 60 minutes total.
    expect(result.projectLengthMinutes).toBe(60);
    expect(result.criticalNodeIds.has("m1")).toBe(true);
    expect(result.criticalNodeIds.has("p1")).toBe(true);
    expect(result.criticalNodeIds.has("m2")).toBe(true);
    // p2 (30m) has slack because the longest branch through p1 is 60m.
    expect(result.criticalNodeIds.has("p2")).toBe(false);
    expect(result.slack.p2).toBe(30);
    expect(result.slack.p1).toBe(0);
  });

  it("treats milestones as zero-duration checkpoints", () => {
    const nodes = [milestone("m1"), project("p1", "m1", 45)];
    const edges: GraphEdge[] = [{ fromNodeId: "m1", toNodeId: "p1", type: "blocks" }];
    const result = criticalPath(nodes, edges);
    expect(result.earliestStart.m1).toBe(0);
    expect(result.earliestFinish.m1).toBe(0);
    expect(result.projectLengthMinutes).toBe(45);
  });

  it("throws CycleError instead of computing on a cyclic graph", () => {
    const nodes = [milestone("a"), milestone("b")];
    const edges = [blocks("a", "b"), blocks("b", "a")];
    expect(() => criticalPath(nodes, edges)).toThrow(CycleError);
  });
});

// --- Fuzz test: mirrors the DB acyclicity trigger's guarantee (AC-3.8) ---
// A seeded PRNG keeps failures reproducible instead of flaking on CI.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomGraph(rand: () => number, nodeCount: number, edgeCount: number) {
  const nodes: GraphNode[] = Array.from({ length: nodeCount }, (_, i) => milestone(`n${i}`));
  const edges: GraphEdge[] = Array.from({ length: edgeCount }, () => {
    const from = `n${Math.floor(rand() * nodeCount)}`;
    const to = `n${Math.floor(rand() * nodeCount)}`;
    return { fromNodeId: from, toNodeId: to, type: "blocks" as const };
  });
  return { nodes, edges };
}

describe("fuzz: breakCycles guarantees acyclicity", () => {
  it("produces an acyclic `blocks` subgraph for 200 random graphs", () => {
    const rand = mulberry32(20260814);
    for (let i = 0; i < 200; i++) {
      const nodeCount = 3 + Math.floor(rand() * 12); // 3..14 nodes
      const edgeCount = Math.floor(rand() * nodeCount * 3); // up to dense
      const { nodes, edges } = randomGraph(rand, nodeCount, edgeCount);

      const { edges: repaired, dropped } = breakCycles(nodes, edges);

      expect(isAcyclic(nodes, repaired)).toBe(true);
      expect(repaired.length + dropped.length).toBe(edges.length);
      // Repaired output must never invent an edge that wasn't in the input.
      for (const e of repaired) expect(edges).toContain(e);

      // topoSort/criticalPath must not throw on the repaired graph.
      expect(() => topoSort(nodes, repaired)).not.toThrow();
      expect(() => criticalPath(nodes, repaired)).not.toThrow();
    }
  });
});

describe("readyNodes", () => {
  it("returns nodes with no blocks predecessors when nothing is complete", () => {
    const nodes = [milestone("a"), milestone("b"), milestone("c")];
    const edges = [blocks("a", "b"), blocks("b", "c")];
    expect(readyNodes(nodes, edges, new Set())).toEqual(["a"]);
  });

  it("unlocks a node once all its predecessors are complete", () => {
    const nodes = [milestone("a"), milestone("b"), milestone("c")];
    const edges = [blocks("a", "c"), blocks("b", "c")];
    // "a" is already complete, so it's excluded from the ready set even
    // though it has no predecessors of its own.
    expect(readyNodes(nodes, edges, new Set(["a"]))).toEqual(["b"]);
    expect(readyNodes(nodes, edges, new Set(["a", "b"]))).toEqual(["c"]);
  });

  it("excludes already-completed nodes from the result", () => {
    const nodes = [milestone("a"), milestone("b")];
    const edges = [blocks("a", "b")];
    expect(readyNodes(nodes, edges, new Set(["a"]))).toEqual(["b"]);
  });

  it("ignores informs edges when computing readiness", () => {
    const nodes = [milestone("a"), milestone("b")];
    const edges = [informs("a", "b")];
    expect(readyNodes(nodes, edges, new Set())).toEqual(["a", "b"]);
  });

  it("every node is ready in a graph with no edges", () => {
    const nodes = [milestone("a"), milestone("b"), milestone("c")];
    expect(readyNodes(nodes, [], new Set())).toEqual(["a", "b", "c"]);
  });
});
