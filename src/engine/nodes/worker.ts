import type { Node } from '@/schema/diagram';
import type { NodeRuntime } from '../types';

export function canPick(node: Extract<Node, { type: 'worker' }>, rt: NodeRuntime): boolean {
  return (rt.workersBusy ?? 0) < node.concurrency * (rt.replicas ?? 1);
}
export function startProcessing(_node: Extract<Node, { type: 'worker' }>, rt: NodeRuntime): void {
  rt.workersBusy = (rt.workersBusy ?? 0) + 1;
}
export function finishProcessing(_node: Extract<Node, { type: 'worker' }>, rt: NodeRuntime): void {
  rt.workersBusy = Math.max(0, (rt.workersBusy ?? 0) - 1);
}
export function finishedAt(node: Extract<Node, { type: 'worker' }>, nowMs: number): number {
  return nowMs + node.latency_ms;
}
