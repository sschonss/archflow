import { describe, it, expect } from 'vitest';
import { DiagramSchema } from '@/schema/diagram';

describe('schema: resources, hpa, cluster', () => {
  it('accepts resources + hpa on a service', () => {
    const r = DiagramSchema.safeParse({
      version: 1,
      nodes: [
        {
          id: 's', type: 'service', label: 'S',
          latency_ms: 10, capacity_rps: 100, error_rate: 0,
          resources: {
            cpu_per_request_ms: 5,
            mem_per_request_mb: 2,
            cpu_limit_ms_per_sec: 1000,
            mem_limit_mb: 512,
          },
          hpa: { min_replicas: 1, max_replicas: 10, target_cpu_pct: 70 },
        },
      ],
      edges: [],
    });
    expect(r.success).toBe(true);
  });

  it('accepts a cluster node with members', () => {
    const r = DiagramSchema.safeParse({
      version: 1,
      nodes: [
        { id: 's', type: 'service', label: 'S', latency_ms: 10, capacity_rps: 100, error_rate: 0 },
        { id: 'cl', type: 'cluster', label: 'Prod', members: ['s'] },
      ],
      edges: [],
    });
    expect(r.success).toBe(true);
  });

  it('rejects hpa with min > max', () => {
    const r = DiagramSchema.safeParse({
      version: 1,
      nodes: [
        {
          id: 's', type: 'service', label: 'S',
          latency_ms: 10, capacity_rps: 100, error_rate: 0,
          hpa: { min_replicas: 5, max_replicas: 2, target_cpu_pct: 70 },
        },
      ],
      edges: [],
    });
    expect(r.success).toBe(false);
  });
});
