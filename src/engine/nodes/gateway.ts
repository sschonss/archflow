import type { Node } from '@/schema/diagram';
import type { NodeRuntime } from '../types';

export function admitGateway(
  node: Extract<Node, { type: 'gateway' }>,
  rt: NodeRuntime,
  nowMs: number,
): { ok: true } | { ok: false; reason: '429' } {
  if (rt.tokens === undefined) {
    rt.tokens = node.rate_limit_rps;
    rt.lastRefillMs = nowMs;
  }
  const elapsed = nowMs - (rt.lastRefillMs ?? nowMs);
  if (elapsed > 0) {
    const refill = (elapsed / 1000) * node.rate_limit_rps;
    rt.tokens = Math.min(node.rate_limit_rps, (rt.tokens ?? 0) + refill);
    rt.lastRefillMs = nowMs;
  }
  if ((rt.tokens ?? 0) >= 1) {
    rt.tokens! -= 1;
    return { ok: true };
  }
  return { ok: false, reason: '429' };
}
