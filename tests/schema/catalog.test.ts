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
