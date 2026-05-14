import { describe, it, expect } from 'vitest';
import { DiagramSchema } from '@/schema/diagram';

describe('schema catalog extensions', () => {
  it('accepts edge tags', () => {
    const r = DiagramSchema.safeParse({
      version: 1,
      nodes: [
        { id: 'c', type: 'client', label: 'C', rps: 1, pattern: 'constant' },
        { id: 's', type: 'service', label: 'S', latency_ms: 10, capacity_rps: 100, error_rate: 0 },
      ],
      edges: [{ id: 'e', source: 'c', target: 's', kind: 'sync', latency_ms: 1, weight: 1, tags: ['scenario:checkout'] }],
    });
    expect(r.success).toBe(true);
  });

  it('accepts a scenarios array', () => {
    const r = DiagramSchema.safeParse({
      version: 1,
      nodes: [{ id: 'c', type: 'client', label: 'C', rps: 1, pattern: 'constant' }],
      edges: [],
      scenarios: [{ id: 'checkout', origin: 'c', color: '#f0a' }],
    });
    expect(r.success).toBe(true);
  });

  it('accepts a cron trigger on a service', () => {
    const r = DiagramSchema.safeParse({
      version: 1,
      nodes: [
        {
          id: 's',
          type: 'service',
          label: 'S',
          latency_ms: 10,
          capacity_rps: 100,
          error_rate: 0,
          triggers: [{ id: 't1', cron: '*/5 * * * *' }],
        },
      ],
      edges: [],
    });
    expect(r.success).toBe(true);
  });
});

const baseDiag = (extraNodes: unknown[]) => ({
  version: 1,
  nodes: [
    { id: 'c', type: 'client', label: 'C', rps: 1, pattern: 'constant' },
    ...extraNodes,
  ],
  edges: [],
});

describe('catalog node kinds', () => {
  it('webhook', () => {
    expect(
      DiagramSchema.safeParse(
        baseDiag([{ id: 'w', type: 'webhook', label: 'W', rps: 2, pattern: 'poisson' }]),
      ).success,
    ).toBe(true);
  });

  it('load_balancer', () => {
    expect(
      DiagramSchema.safeParse(
        baseDiag([{ id: 'lb', type: 'load_balancer', label: 'LB', strategy: 'round_robin' }]),
      ).success,
    ).toBe(true);
  });

  it('gateway', () => {
    expect(
      DiagramSchema.safeParse(
        baseDiag([
          { id: 'g', type: 'gateway', label: 'G', rate_limit_rps: 50, auth_check_ms: 2 },
        ]),
      ).success,
    ).toBe(true);
  });

  it('worker', () => {
    expect(
      DiagramSchema.safeParse(
        baseDiag([
          { id: 'wk', type: 'worker', label: 'WK', concurrency: 4, latency_ms: 20, error_rate: 0 },
        ]),
      ).success,
    ).toBe(true);
  });

  it('queue', () => {
    expect(
      DiagramSchema.safeParse(
        baseDiag([
          { id: 'q', type: 'queue', label: 'Q', max_depth: 1000, on_overflow: 'drop' },
        ]),
      ).success,
    ).toBe(true);
  });

  it('cache', () => {
    expect(
      DiagramSchema.safeParse(
        baseDiag([{ id: 'r', type: 'cache', label: 'R', hit_rate: 0.8, latency_ms: 1 }]),
      ).success,
    ).toBe(true);
  });

  it('database', () => {
    expect(
      DiagramSchema.safeParse(
        baseDiag([
          {
            id: 'db',
            type: 'database',
            label: 'DB',
            pool_size: 20,
            query_latency_ms: 5,
            timeout_ms: 100,
          },
        ]),
      ).success,
    ).toBe(true);
  });
});

