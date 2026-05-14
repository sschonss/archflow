import { describe, it, expect } from 'vitest';
import { parseCron, nextFire } from '@/engine/triggers';

describe('cron parser (minimal: minute field only, supports * | N | */N)', () => {
  it('every minute', () => {
    const c = parseCron('* * * * *');
    expect(nextFire(c, 0)).toBe(60_000);
    expect(nextFire(c, 60_000)).toBe(120_000);
  });

  it('every 5 minutes', () => {
    const c = parseCron('*/5 * * * *');
    expect(nextFire(c, 0)).toBe(5 * 60_000);
  });

  it('exact minute=15', () => {
    const c = parseCron('15 * * * *');
    expect(nextFire(c, 0)).toBe(15 * 60_000);
    expect(nextFire(c, 16 * 60_000)).toBe((60 + 15) * 60_000);
  });
});
