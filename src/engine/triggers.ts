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
