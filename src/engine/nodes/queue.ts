import type { Node } from '@/schema/diagram';
import type { NodeRuntime } from '../types';

export function enqueue(
  node: Extract<Node, { type: 'queue' }>,
  rt: NodeRuntime,
  particleId: number,
): { ok: true } | { ok: false; reason: 'queue_overflow' } {
  if (!rt.queue) rt.queue = [];
  if (rt.queue.length >= node.max_depth) return { ok: false, reason: 'queue_overflow' };
  rt.queue.push(particleId);
  return { ok: true };
}

export function dequeue(rt: NodeRuntime): number | undefined {
  if (!rt.queue) return undefined;
  return rt.queue.shift();
}

export function queueDepth(rt: NodeRuntime): number {
  return rt.queue?.length ?? 0;
}
