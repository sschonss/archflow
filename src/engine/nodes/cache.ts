import type { Node } from '@/schema/diagram';

export function cacheLookup(
  node: Extract<Node, { type: 'cache' }>,
  rng: () => number,
): { hit: boolean; latencyMs: number } {
  return { hit: rng() < node.hit_rate, latencyMs: node.latency_ms };
}
