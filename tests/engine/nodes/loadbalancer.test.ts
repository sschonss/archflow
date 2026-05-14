import { describe, it, expect } from 'vitest';
import { pickBackend } from '@/engine/nodes/loadbalancer';
import { mulberry32 } from '@/engine/rng';

const edges = ['a', 'b', 'c'];

describe('load balancer strategies', () => {
  it('round_robin cycles through backends', () => {
    const rt: { rrCursor?: number } = {};
    expect(pickBackend('round_robin', edges, rt, mulberry32(1), {})).toBe('a');
    expect(pickBackend('round_robin', edges, rt, mulberry32(1), {})).toBe('b');
    expect(pickBackend('round_robin', edges, rt, mulberry32(1), {})).toBe('c');
    expect(pickBackend('round_robin', edges, rt, mulberry32(1), {})).toBe('a');
  });

  it('least_conn picks the backend with lowest in-flight', () => {
    const inFlight = { a: 5, b: 1, c: 3 };
    expect(pickBackend('least_conn', edges, {}, mulberry32(1), inFlight)).toBe('b');
  });

  it('random picks one of the edges deterministically with seed', () => {
    const r = mulberry32(123);
    const x = pickBackend('random', edges, {}, r, {});
    expect(edges).toContain(x);
  });
});
