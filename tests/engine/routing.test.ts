import { describe, it, expect } from 'vitest';
import { chooseEdge } from '@/engine/routing';
import { mulberry32 } from '@/engine/rng';

const e = (id: string, weight = 1, tags: string[] = []) =>
  ({ id, source: 'a', target: 'b', kind: 'sync', latency_ms: 1, weight, tags }) as const;

describe('chooseEdge', () => {
  it('returns the only edge when single', () => {
    const rng = mulberry32(1);
    expect(chooseEdge([e('e1')], undefined, rng)?.id).toBe('e1');
  });

  it('prefers a scenario-tagged edge when scenarioId matches', () => {
    const rng = mulberry32(1);
    const out = chooseEdge(
      [e('e1', 10), e('e2', 1, ['scenario:checkout'])],
      'checkout',
      rng,
    );
    expect(out?.id).toBe('e2');
  });

  it('weighted: distribution roughly matches weights', () => {
    const rng = mulberry32(42);
    const counts: Record<string, number> = { e1: 0, e2: 0 };
    for (let i = 0; i < 10000; i++) {
      const ed = chooseEdge([e('e1', 1), e('e2', 3)], undefined, rng)!;
      counts[ed.id]++;
    }
    // expect e2 ~ 75% ± 3%
    expect(counts.e2 / 10000).toBeGreaterThan(0.72);
    expect(counts.e2 / 10000).toBeLessThan(0.78);
  });

  it('returns undefined for empty list', () => {
    const rng = mulberry32(1);
    expect(chooseEdge([], undefined, rng)).toBeUndefined();
  });
});
