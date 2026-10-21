import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { LEVELS } from '../src/data/levels';
import { FULL_HIT_STOP_MS, WIN_BEAT_MS, WIN_HIT_STOP_MS } from '../src/game/feel';
import { cascade } from '../src/game/timeline';

/** Every tap of every stored solution: its cascade (D5) in level order. */
function taps(): { level: number; ms: number; drained: number; fulls: number; won: boolean }[] {
  const out: { level: number; ms: number; drained: number; fulls: number; won: boolean }[] = [];
  for (const level of LEVELS) {
    const g = new Game(level);
    for (const lane of level.solution) {
      const { events } = g.tap(lane);
      out.push({ level: level.id, ...cascade(events), won: g.status === 'won' });
    }
  }
  return out;
}

describe('cadence (GDD §3a, D5)', () => {
  it('a tap that ends in a full meal releases 0.5–2 s of motion: median inside, ≥ 95 % inside over the stored solutions', () => {
    const all = taps();
    expect(all.length).toBe(LEVELS.reduce((n, l) => n + l.solution.length, 0));
    const meals = all
      .filter((t) => t.fulls > 0)
      .map((t) => t.ms)
      .sort((a, b) => a - b);
    const median = meals[Math.floor(meals.length / 2)] as number;
    expect(median).toBeGreaterThanOrEqual(500);
    expect(median).toBeLessThanOrEqual(2000);
    const inside = meals.filter((ms) => ms >= 500 && ms <= 2000).length / meals.length;
    expect(inside).toBeGreaterThanOrEqual(0.95);
    // the cascade counts every hit stop of its meals: they hold the motion, the player waits them
    const one = all.find((t) => t.fulls === 1 && !t.won);
    expect(one && one.ms - one.drained).toBeGreaterThan(0);
    expect(FULL_HIT_STOP_MS).toBeGreaterThan(0);
  });

  it('micro-win cadence: tapping as soon as each cascade drains, a muncher finishes at least every 10 s', () => {
    // A finish (a full meal or the win) every few seconds, never a 10 s stretch without one
    // (GDD §3a), on every level of the list at the capture's pace.
    const byLevel = new Map<number, ReturnType<typeof taps>>();
    for (const t of taps()) byLevel.set(t.level, [...(byLevel.get(t.level) ?? []), t]);
    for (const [level, list] of byLevel) {
      let now = 0;
      let lastFinish = 0;
      let worst = 0;
      for (const t of list) {
        if (t.fulls > 0 || t.won) {
          worst = Math.max(worst, now + t.drained - lastFinish);
          lastFinish = now + t.drained;
        }
        now += t.won ? t.drained + WIN_BEAT_MS + WIN_HIT_STOP_MS : t.drained;
      }
      expect(worst, `level ${String(level)}`).toBeLessThan(10_000);
    }
  });
});
