import { describe, it, expect } from 'vitest';
import { tickWebhook } from '@/engine/nodes/webhook';
import { mulberry32 } from '@/engine/rng';
import { emptyWindow } from '@/engine/metrics';

describe('webhook poisson emission', () => {
  it('emits ~rps particles per second over a long horizon', () => {
    const rng = mulberry32(7);
    const node = { id: 'w', type: 'webhook' as const, label: 'W', rps: 10, pattern: 'poisson' as const };
    const rt = { inFlight: 0 };
    const ctx = { rng, dtMs: 100, nowMs: 0 };
    emptyWindow();  // kept per plan
    let emitted = 0;
    for (let t = 0; t < 10_000; t += 100) {
      const out = tickWebhook(node, rt, { ...ctx, nowMs: t });
      emitted += out.length;
    }
    // 10 rps * 10s = ~100, allow ±20%
    expect(emitted).toBeGreaterThan(80);
    expect(emitted).toBeLessThan(120);
  });
});
