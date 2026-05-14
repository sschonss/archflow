import { describe, it, expect } from 'vitest';
import { cacheLookup } from '@/engine/nodes/cache';
import { mulberry32 } from '@/engine/rng';

describe('cache', () => {
  it('hit rate ~ matches configured value', () => {
    const node = { id: 'c', type: 'cache' as const, label: 'C', hit_rate: 0.8, latency_ms: 1 };
    const rng = mulberry32(99);
    let hits = 0;
    for (let i = 0; i < 10000; i++) if (cacheLookup(node, rng).hit) hits++;
    expect(hits / 10000).toBeGreaterThan(0.77);
    expect(hits / 10000).toBeLessThan(0.83);
  });
});
