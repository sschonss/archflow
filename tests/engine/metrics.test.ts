import { describe, it, expect } from 'vitest';
import {
  emptyWindow,
  recordEmit,
  recordComplete,
  recordFail,
  recordQueueDepth,
  computeStats,
  WINDOW_MS,
} from '@/engine/metrics';

describe('metrics sliding window', () => {
  it('rps_in counts only events within the window', () => {
    let w = emptyWindow();
    w = recordEmit(w, 0);
    w = recordEmit(w, 1000);
    w = recordEmit(w, 2000);
    const stats = computeStats(w, 2000);
    // 3 emits over 10s window → 0.3 rps
    expect(stats.rps_in).toBeCloseTo(3 / (WINDOW_MS / 1000), 5);
  });

  it('drops events older than WINDOW_MS', () => {
    let w = emptyWindow();
    w = recordEmit(w, 0);
    w = recordEmit(w, WINDOW_MS + 100);
    const s = computeStats(w, WINDOW_MS + 100);
    expect(s.rps_in).toBeCloseTo(1 / (WINDOW_MS / 1000), 5);
  });

  it('error_rate = fails / (completes + fails)', () => {
    let w = emptyWindow();
    w = recordComplete(w, 100, 10);
    w = recordComplete(w, 200, 12);
    w = recordComplete(w, 300, 15);
    w = recordFail(w, 400);
    const s = computeStats(w, 400);
    expect(s.error_rate).toBeCloseTo(0.25, 5);
  });

  it('p50/p95/p99 latencies', () => {
    let w = emptyWindow();
    for (let i = 1; i <= 100; i++) w = recordComplete(w, i, i);
    const s = computeStats(w, 100);
    expect(s.p50).toBe(50);
    expect(s.p95).toBe(95);
    expect(s.p99).toBe(99);
  });

  it('queue_depth uses last sample within window', () => {
    let w = emptyWindow();
    w = recordQueueDepth(w, 0, 5);
    w = recordQueueDepth(w, 100, 12);
    const s = computeStats(w, 100);
    expect(s.queue_depth).toBe(12);
  });
});
