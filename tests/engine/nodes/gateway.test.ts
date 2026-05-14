import { describe, it, expect } from 'vitest';
import { admitGateway } from '@/engine/nodes/gateway';

describe('gateway rate limit', () => {
  it('admits within budget, rejects with 429 over budget', () => {
    const node = { id: 'g', type: 'gateway' as const, label: 'G', rate_limit_rps: 10, auth_check_ms: 0 };
    const rt = { inFlight: 0, tokens: undefined as number | undefined, lastRefillMs: 0 };
    let admitted = 0;
    let rejected = 0;
    for (let i = 0; i < 30; i++) {
      const r = admitGateway(node, rt, 0);
      if (r.ok) admitted++; else { expect(r.reason).toBe('429'); rejected++; }
    }
    expect(admitted).toBe(10);
    expect(rejected).toBe(20);
  });

  it('refills tokens over time', () => {
    const node = { id: 'g', type: 'gateway' as const, label: 'G', rate_limit_rps: 10, auth_check_ms: 0 };
    const rt = { inFlight: 0, tokens: undefined as number | undefined, lastRefillMs: 0 };
    for (let i = 0; i < 10; i++) admitGateway(node, rt, 0);
    expect(admitGateway(node, rt, 0).ok).toBe(false);
    // 1 second later: 10 new tokens
    for (let i = 0; i < 10; i++) expect(admitGateway(node, rt, 1000).ok).toBe(true);
    expect(admitGateway(node, rt, 1000).ok).toBe(false);
  });
});
