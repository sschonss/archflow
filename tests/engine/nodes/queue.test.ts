import { describe, it, expect } from 'vitest';
import { enqueue, dequeue, queueDepth } from '@/engine/nodes/queue';

describe('queue', () => {
  it('FIFO order', () => {
    const node = { id: 'q', type: 'queue' as const, label: 'Q', max_depth: 10, on_overflow: 'drop' as const };
    const rt = { inFlight: 0, queue: [] as number[] };
    expect(enqueue(node, rt, 1).ok).toBe(true);
    expect(enqueue(node, rt, 2).ok).toBe(true);
    expect(dequeue(rt)).toBe(1);
    expect(dequeue(rt)).toBe(2);
    expect(dequeue(rt)).toBeUndefined();
  });

  it('drops on overflow', () => {
    const node = { id: 'q', type: 'queue' as const, label: 'Q', max_depth: 2, on_overflow: 'drop' as const };
    const rt = { inFlight: 0, queue: [] as number[] };
    enqueue(node, rt, 1); enqueue(node, rt, 2);
    const r = enqueue(node, rt, 3);
    expect(r.ok).toBe(false);
    expect((r as { ok: false; reason: string }).reason).toBe('queue_overflow');
    expect(queueDepth(rt)).toBe(2);
  });
});
