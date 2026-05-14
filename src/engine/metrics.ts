import type { MetricsWindow } from './types';

export const WINDOW_MS = 10_000;

export function emptyWindow(): MetricsWindow {
  return { emits: [], completes: [], fails: [], latencies: [], queueDepth: [] };
}

const trim = (arr: number[], cutoff: number) => {
  while (arr.length > 0 && arr[0] < cutoff) arr.shift();
};
const trimObj = <T extends { t: number }>(arr: T[], cutoff: number) => {
  while (arr.length > 0 && arr[0].t < cutoff) arr.shift();
};

export function recordEmit(w: MetricsWindow, t: number): MetricsWindow {
  w.emits.push(t);
  trim(w.emits, t - WINDOW_MS);
  return w;
}

export function recordComplete(w: MetricsWindow, t: number, latencyMs: number): MetricsWindow {
  w.completes.push(t);
  w.latencies.push({ t, ms: latencyMs });
  trim(w.completes, t - WINDOW_MS);
  trimObj(w.latencies, t - WINDOW_MS);
  return w;
}

export function recordFail(w: MetricsWindow, t: number): MetricsWindow {
  w.fails.push(t);
  trim(w.fails, t - WINDOW_MS);
  return w;
}

export function recordQueueDepth(w: MetricsWindow, t: number, depth: number): MetricsWindow {
  w.queueDepth.push({ t, n: depth });
  trimObj(w.queueDepth, t - WINDOW_MS);
  return w;
}

export interface Stats {
  rps_in: number;
  rps_out: number;
  error_rate: number;
  p50: number;
  p95: number;
  p99: number;
  queue_depth: number;
  throughput_total: number;
}

const pct = (sorted: number[], p: number) => {
  if (sorted.length === 0) return 0;
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
};

export function computeStats(w: MetricsWindow, nowMs: number): Stats {
  const cutoff = nowMs - WINDOW_MS;
  trim(w.emits, cutoff); trim(w.completes, cutoff); trim(w.fails, cutoff);
  trimObj(w.latencies, cutoff); trimObj(w.queueDepth, cutoff);
  const sorted = w.latencies.map((l) => l.ms).sort((a, b) => a - b);
  const total = w.completes.length + w.fails.length;
  return {
    rps_in: w.emits.length / (WINDOW_MS / 1000),
    rps_out: w.completes.length / (WINDOW_MS / 1000),
    error_rate: total === 0 ? 0 : w.fails.length / total,
    p50: pct(sorted, 50),
    p95: pct(sorted, 95),
    p99: pct(sorted, 99),
    queue_depth: w.queueDepth.length === 0 ? 0 : w.queueDepth[w.queueDepth.length - 1].n,
    throughput_total: w.completes.length,
  };
}
