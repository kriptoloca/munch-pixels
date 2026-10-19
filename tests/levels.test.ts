import { describe, expect, it } from 'vitest';
import levelsJson from '../src/data/levels.json';
import { snackById } from '../src/data/snacks';
import { SLOTS, validateLevel, type Level } from '../src/gen/level';
import { BANDS, BREATHER_DROP, LEVEL_COUNT, isPlanningPeak } from '../src/gen/params';
import { hashSeed } from '../src/gen/rng';

const levels = levelsJson as Level[];

describe('the level list (src/data/levels.json, GENERATOR.md §6)', () => {
  it('holds LEVEL_COUNT levels numbered 1..N', () => {
    expect(levels).toHaveLength(LEVEL_COUNT);
    expect(levels.map((l) => l.id)).toEqual(levels.map((_, i) => i + 1));
  });

  it('every level validates and its stored solution replays to a win without boosters', () => {
    for (const l of levels) {
      expect(validateLevel(l), `level ${String(l.id)}`).toEqual([]);
      expect(l.slots).toBe(SLOTS);
      expect(l.metrics.peakSlots).toBeLessThanOrEqual(SLOTS);
      expect(() => snackById(l.snack.replace(/-m$/, ''))).not.toThrow();
      expect(l.face).toBe(hashSeed(`face:${String(l.id)}`));
    }
  });

  it('difficulty rises band by band (average of 1 − random-player win rate)', () => {
    const avg: number[] = BANDS.map((b, i) => {
      const to = BANDS[i + 1]?.from ?? LEVEL_COUNT + 1;
      const d = levels.filter((l) => l.id >= b.from && l.id < to).map((l) => l.metrics.difficulty);
      return d.reduce((a, x) => a + x, 0) / d.length;
    });
    for (let i = 1; i < avg.length; i++) {
      expect(avg[i], `band ${String(i)}`).toBeGreaterThan(avg[i - 1] as number);
    }
    // the first levels teach: a random player always wins them
    expect(levels.slice(0, 3).every((l) => l.metrics.difficulty === 0)).toBe(true);
    expect(avg.at(-1)).toBeGreaterThan(0.4);
  });

  it('the 10-level moving average never falls more than one breather below its best', () => {
    const d = levels.map((l) => l.metrics.difficulty);
    let best = 0;
    for (let i = 10; i <= d.length; i++) {
      const avg = d.slice(i - 10, i).reduce((a, x) => a + x, 0) / 10;
      best = Math.max(best, avg);
      expect(best - avg, `levels ${String(i - 9)}–${String(i)}`).toBeLessThanOrEqual(BREATHER_DROP);
    }
  });

  it('planning peaks ask for planning: the greedy player loses them far more often', () => {
    const share = (ls: Level[]): number =>
      ls.filter((l) => !l.metrics.greedyWin).length / ls.length;
    const peaks = levels.filter((l) => isPlanningPeak(l.id));
    const others = levels.filter((l) => !isPlanningPeak(l.id));
    expect(peaks.length).toBeGreaterThan(0);
    expect(share(peaks)).toBeGreaterThanOrEqual(0.5);
    expect(share(peaks)).toBeGreaterThan(2 * share(others));
  });
});
