import type { Edge } from '@/schema/diagram';

export function chooseEdge(
  outEdges: ReadonlyArray<Edge>,
  scenarioId: string | undefined,
  rng: () => number,
): Edge | undefined {
  if (outEdges.length === 0) return undefined;
  if (scenarioId) {
    const tag = `scenario:${scenarioId}`;
    const pinned = outEdges.filter((e) => e.tags?.includes(tag));
    if (pinned.length > 0) return weighted(pinned, rng);
  }
  return weighted(outEdges, rng);
}

function weighted(edges: ReadonlyArray<Edge>, rng: () => number): Edge {
  const total = edges.reduce((s, e) => s + (e.weight ?? 1), 0);
  let r = rng() * total;
  for (const e of edges) {
    r -= e.weight ?? 1;
    if (r <= 0) return e;
  }
  return edges[edges.length - 1];
}
