export function pickBackend(
  strategy: 'round_robin' | 'least_conn' | 'random',
  backends: string[],
  rt: { rrCursor?: number },
  rng: () => number,
  inFlightByBackend: Record<string, number>,
): string {
  if (backends.length === 0) throw new Error('no backends');
  if (strategy === 'random') return backends[Math.floor(rng() * backends.length)];
  if (strategy === 'least_conn') {
    return backends.reduce((best, b) =>
      (inFlightByBackend[b] ?? 0) < (inFlightByBackend[best] ?? 0) ? b : best,
    );
  }
  const cursor = rt.rrCursor ?? 0;
  const pick = backends[cursor % backends.length];
  rt.rrCursor = (cursor + 1) % backends.length;
  return pick;
}
