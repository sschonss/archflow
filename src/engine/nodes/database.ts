import type { Node } from '@/schema/diagram';
import type { NodeRuntime } from '../types';

export function acquireConn(
  node: Extract<Node, { type: 'database' }>,
  rt: NodeRuntime,
  particleId: number,
  nowMs: number,
): { granted: boolean } {
  if ((rt.poolUsed ?? 0) < node.pool_size) {
    rt.poolUsed = (rt.poolUsed ?? 0) + 1;
    return { granted: true };
  }
  if (!rt.waiters) rt.waiters = [];
  rt.waiters.push({ particleId, deadlineMs: nowMs + node.timeout_ms });
  return { granted: false };
}

export function releaseConn(rt: NodeRuntime, _nowMs: number): number | undefined {
  if (!rt.waiters || rt.waiters.length === 0) {
    rt.poolUsed = Math.max(0, (rt.poolUsed ?? 1) - 1);
    return undefined;
  }
  const next = rt.waiters.shift()!;
  return next.particleId;
}

export function expireWaiters(rt: NodeRuntime, nowMs: number): number[] {
  if (!rt.waiters) return [];
  const expired: number[] = [];
  rt.waiters = rt.waiters.filter((w) => {
    if (w.deadlineMs <= nowMs) { expired.push(w.particleId); return false; }
    return true;
  });
  return expired;
}
