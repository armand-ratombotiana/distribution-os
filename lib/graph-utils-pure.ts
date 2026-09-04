/**
 * Pure graph utility helpers. Graphs are represented as an adjacency map:
 *   { nodeKey: string[] } where each value is the list of node keys that
 *   the key has a directed edge into.
 *
 * All functions are pure: they do not mutate their inputs.
 */

export type Graph = Record<string, string[]>;

/** Returns the list of neighbors (outgoing edges) for a node, or []. */
export function getNeighbors(graph: Graph, node: string): string[] {
  if (typeof node !== "string") return [];
  const list = graph?.[node];
  return Array.isArray(list) ? list.slice() : [];
}

/**
 * Topologically sorts the graph using Kahn's algorithm. Throws when the
 * graph contains a cycle. Returns nodes in dependency-first order.
 */
export function topologicalSort(graph: Graph): string[] {
  if (!graph || typeof graph !== "object") {
    throw new TypeError("topologicalSort expects a graph object");
  }
  const nodes = Object.keys(graph);
  const indegree: Record<string, number> = {};
  for (const n of nodes) indegree[n] = 0;
  for (const n of nodes) {
    for (const m of graph[n] ?? []) {
      if (!Object.prototype.hasOwnProperty.call(indegree, m)) {
        indegree[m] = 0;
        nodes.push(m);
      }
      indegree[m] += 1;
    }
  }
  const queue: string[] = nodes.filter((n) => indegree[n] === 0).sort();
  const out: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    out.push(node);
    const neighbors = (graph[node] ?? []).slice().sort();
    for (const m of neighbors) {
      indegree[m] -= 1;
      if (indegree[m] === 0) {
        // Insert in sorted position so the result is deterministic.
        const idx = queue.findIndex((q) => q > m);
        if (idx === -1) queue.push(m);
        else queue.splice(idx, 0, m);
      }
    }
  }
  if (out.length !== Object.keys(indegree).length) {
    throw new Error("topologicalSort: graph contains a cycle");
  }
  return out;
}

/**
 * Returns true if the graph contains a cycle. Uses DFS with three colors
 * (white/grey/black) for O(V+E) detection.
 */
export function detectCycles(graph: Graph): boolean {
  if (!graph || typeof graph !== "object") return false;
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const color: Record<string, number> = {};
  for (const n of Object.keys(graph)) color[n] = WHITE;
  for (const n of Object.keys(graph)) {
    if (color[n] !== WHITE) continue;
    const stack: Array<[string, number]> = [[n, 0]];
    color[n] = GREY;
    while (stack.length > 0) {
      const [node, idx] = stack[stack.length - 1];
      const neighbors = graph[node] ?? [];
      if (idx >= neighbors.length) {
        color[node] = BLACK;
        stack.pop();
        continue;
      }
      stack[stack.length - 1][1] += 1;
      const next = neighbors[idx];
      if (!Object.prototype.hasOwnProperty.call(color, next)) {
        color[next] = WHITE;
      }
      if (color[next] === GREY) return true;
      if (color[next] === WHITE) {
        color[next] = GREY;
        stack.push([next, 0]);
      }
    }
  }
  return false;
}

/**
 * Finds the shortest path (BFS, unweighted) from `start` to `target`.
 * Returns an array of node keys, or `undefined` if no path exists.
 */
export function findShortestPath(
  graph: Graph,
  start: string,
  target: string,
): string[] | undefined {
  if (!graph || typeof graph !== "object") return undefined;
  if (typeof start !== "string" || typeof target !== "string") return undefined;
  if (start === target) return [start];
  const visited = new Set<string>([start]);
  const queue: Array<{ node: string; path: string[] }> = [
    { node: start, path: [start] },
  ];
  while (queue.length > 0) {
    const { node, path } = queue.shift()!;
    for (const next of graph[node] ?? []) {
      if (visited.has(next)) continue;
      const newPath = path.concat(next);
      if (next === target) return newPath;
      visited.add(next);
      queue.push({ node: next, path: newPath });
    }
  }
  return undefined;
}
