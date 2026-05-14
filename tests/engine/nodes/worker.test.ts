import { describe, it, expect } from 'vitest';
import { canPick, startProcessing, finishedAt } from '@/engine/nodes/worker';

describe('worker', () => {
  it('respects concurrency', () => {
    const node = { id: 'w', type: 'worker' as const, label: 'W', concurrency: 2, latency_ms: 100, error_rate: 0 };
    const rt = { inFlight: 0, workersBusy: 0 };
    expect(canPick(node, rt)).toBe(true);
    startProcessing(node, rt); startProcessing(node, rt);
    expect(rt.workersBusy).toBe(2);
    expect(canPick(node, rt)).toBe(false);
  });

  it('replicas multiply concurrency', () => {
    const node = { id: 'w', type: 'worker' as const, label: 'W', concurrency: 2, latency_ms: 100, error_rate: 0 };
    const rt = { inFlight: 0, workersBusy: 0, replicas: 2 };
    startProcessing(node, rt); startProcessing(node, rt);
    expect(canPick(node, rt)).toBe(true);
    startProcessing(node, rt); startProcessing(node, rt);
    expect(rt.workersBusy).toBe(4);
    expect(canPick(node, rt)).toBe(false);
  });

  it('finishedAt = now + latency_ms', () => {
    const node = { id: 'w', type: 'worker' as const, label: 'W', concurrency: 1, latency_ms: 50, error_rate: 0 };
    expect(finishedAt(node, 1000)).toBe(1050);
  });
});
