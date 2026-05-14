import { describe, it, expect } from 'vitest';
import { acquireConn, releaseConn, expireWaiters } from '@/engine/nodes/database';

describe('database connection pool', () => {
  it('grants conns up to pool_size, then queues waiters', () => {
    const node = { id: 'db', type: 'database' as const, label: 'DB', pool_size: 2, query_latency_ms: 10, timeout_ms: 100 };
    const rt = { inFlight: 0, poolUsed: 0, waiters: [] as { particleId: number; deadlineMs: number }[] };
    expect(acquireConn(node, rt, 1, 0).granted).toBe(true);
    expect(acquireConn(node, rt, 2, 0).granted).toBe(true);
    const r = acquireConn(node, rt, 3, 0);
    expect(r.granted).toBe(false);
    expect(rt.waiters.length).toBe(1);
  });

  it('expireWaiters returns timed-out particle ids', () => {
    const rt = { inFlight: 0, poolUsed: 1, waiters: [{ particleId: 9, deadlineMs: 50 }] };
    expect(expireWaiters(rt, 200)).toEqual([9]);
    expect(rt.waiters).toEqual([]);
  });

  it('releaseConn promotes the next waiter', () => {
    const rt = { inFlight: 0, poolUsed: 1, waiters: [{ particleId: 7, deadlineMs: 1000 }] };
    const promoted = releaseConn(rt, 100);
    expect(promoted).toBe(7);
    expect(rt.poolUsed).toBe(1);
    expect(rt.waiters).toEqual([]);
  });
});
