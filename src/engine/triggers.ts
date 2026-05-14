import type { Diagram } from '@/schema/diagram';
import type { EngineState } from './types';

// Minimal cron: only the first (minute) field is interpreted.
// Supported: '*', 'N', '*/N'. Other fields ignored. Sim-time only (ms).
export interface Cron {
  every?: number;
  exact?: number;
}

export function parseCron(spec: string): Cron {
  const minute = spec.trim().split(/\s+/)[0] ?? '*';
  if (minute === '*') return { every: 1 };
  const m = /^\*\/(\d+)$/.exec(minute);
  if (m) return { every: parseInt(m[1], 10) };
  if (/^\d+$/.test(minute)) return { exact: parseInt(minute, 10) };
  return { every: 1 };
}

export function nextFire(c: Cron, fromMs: number): number {
  const minute = 60_000;
  if (c.every) {
    const stride = c.every * minute;
    return Math.floor(fromMs / stride) * stride + stride;
  }
  if (c.exact !== undefined) {
    const hour = 60 * minute;
    const within = fromMs % hour;
    const target = c.exact * minute;
    return fromMs - within + (within < target ? target : hour + target);
  }
  return fromMs + minute;
}

export function tickTriggers(state: EngineState, diag: Diagram): void {
  for (const node of diag.nodes) {
    if (node.type !== 'service' && node.type !== 'worker') continue;
    if (!node.triggers || node.triggers.length === 0) continue;
    const rt = state.nodes[node.id];
    if (!rt) continue;
    rt.cronNextMs ??= {};

    for (const trigger of node.triggers) {
      const cron = parseCron(trigger.cron);
      const next = rt.cronNextMs[trigger.id] ?? nextFire(cron, state.nowMs - 1);
      if (state.nowMs >= next) {
        state.particles.push({
          id: state.nextParticleId++,
          originType: 'cron',
          bornAt: state.nowMs,
          location: { kind: 'node', id: node.id },
          status: 'processing',
        });
        state.counters.emitted += 1;
        rt.cronNextMs[trigger.id] = nextFire(cron, state.nowMs);
      } else {
        rt.cronNextMs[trigger.id] = next;
      }
    }
  }
}
