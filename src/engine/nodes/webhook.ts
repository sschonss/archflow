import type { NodeRuntime, Particle } from '../types';
import type { Node } from '@/schema/diagram';

export interface NodeCtx { rng: () => number; dtMs: number; nowMs: number; }

export function tickWebhook(
  node: Extract<Node, { type: 'webhook' }>,
  _rt: NodeRuntime,
  ctx: NodeCtx,
): Pick<Particle, 'originType' | 'bornAt'>[] {
  const expected = node.rps * (ctx.dtMs / 1000);
  if (node.pattern === 'burst') {
    if (ctx.nowMs % 1000 < ctx.dtMs) {
      const n = Math.round(node.rps);
      return Array.from({ length: n }, () => ({ originType: 'webhook', bornAt: ctx.nowMs }));
    }
    return [];
  }
  // poisson: simple Knuth algorithm per tick
  const L = Math.exp(-expected);
  let k = 0; let p = 1;
  while (p > L) {
    k++;
    p *= ctx.rng();
  }
  const count = k - 1;
  return Array.from({ length: count }, () => ({ originType: 'webhook', bornAt: ctx.nowMs }));
}
