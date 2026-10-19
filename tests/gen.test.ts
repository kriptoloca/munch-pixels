import { describe, expect, it } from 'vitest';
import { Game, replay } from '../src/core/game';
import { SNACKS } from '../src/data/snacks';
import { dealLanes, generate, planMunchers } from '../src/gen/generate';
import { outline } from '../src/gen/build-levels';
import { MAX_LANES, SLOTS, validateLevel } from '../src/gen/level';
import { findLosingTaps, firstMoveTraps, greedyWins, randomWinRate } from '../src/gen/metrics';
import {
  BANDS,
  OUTLINE_KEY,
  bandFor,
  escalate,
  isPlanningPeak,
  targetFor,
} from '../src/gen/params';
import { Rng, hashSeed } from '../src/gen/rng';
import { solve } from '../src/gen/solve';

const RING = ['rrr', 'rgr', 'rrr'];
/** GENERATOR.md §8 and TASKS Epic 2: invariants over 200 seeds per band. */
const SEEDS_PER_BAND = 200;

describe('generator (GENERATOR.md §3)', () => {
  it('is deterministic: the same seed gives the same level', () => {
    const rows = outline(SNACKS[12]?.rows ?? [], OUTLINE_KEY);
    const p = { ...paramsOf(BANDS[3]), lanes: 4 };
    expect(generate(rows, p, 42)).toEqual(generate(rows, p, 42));
    expect(generate(rows, p, 42)).not.toEqual(generate(rows, p, 43));
  });

  it('every band: 200 seeds give valid levels whose plan replays to a win within the slots', () => {
    let made = 0;
    BANDS.forEach((band, b) => {
      for (let k = 0; k < SEEDS_PER_BAND; k++) {
        const snack = SNACKS[(b * 7 + k) % SNACKS.length];
        if (!snack) continue;
        const rows = band.outline ? outline(snack.rows, OUTLINE_KEY) : [...snack.rows];
        const seed = hashSeed(`test:${String(b)}:${String(k)}`);
        const lanes = new Rng(seed).pick(band.lanes);
        const gen = generate(rows, { ...paramsOf(band), lanes }, seed);
        expect(gen, `${snack.id} band ${String(b)} seed ${String(k)}`).not.toBeNull();
        if (!gen) continue;
        made += 1;
        const problems = validateLevel({
          snack: snack.id,
          rows,
          lanes: gen.lanes,
          slots: SLOTS,
          solution: gen.solution,
        });
        expect(problems, snack.id).toEqual([]);
        expect(gen.peakSlots).toBeLessThanOrEqual(Math.min(SLOTS, band.waitBudget + 1));
        expect(gen.lanes).toHaveLength(lanes);
      }
    });
    expect(made).toBe(SEEDS_PER_BAND * BANDS.length);
  });

  it('the plan covers every pixel exactly (appetites add up per colour)', () => {
    const rows = outline(SNACKS[25]?.rows ?? [], OUTLINE_KEY);
    const planned = planMunchers(rows, { ...paramsOf(BANDS[4]), lanes: 4 }, new Rng(7));
    expect(planned).not.toBeNull();
    const total = (planned ?? []).reduce((n, m) => n + m.a, 0);
    expect(total).toBe(rows.join('').replace(/\./g, '').length);
  });

  it('dealing never leaves a lane empty, even with long runs and few munchers', () => {
    for (let seed = 0; seed < 300; seed++) {
      const planned = Array.from({ length: 5 + (seed % 4) }, (_, i) => ({ c: 'r', a: i + 1 }));
      const { lanes } = dealLanes(planned, 5, new Rng(seed), 0.95);
      expect(
        lanes.every((l) => l.length > 0),
        `seed ${String(seed)}`,
      ).toBe(true);
    }
  });

  it('dealing keeps the planned order inside every lane, so the plan is legal', () => {
    const planned = Array.from({ length: 20 }, (_, i) => ({ c: 'r', a: i + 1 }));
    for (const run of [0, 0.6, 1]) {
      const { lanes, solution } = dealLanes(planned, 3, new Rng(3), run);
      const seen = lanes.map(() => 0);
      const order = solution.map((lane) => {
        const m = lanes[lane]?.[seen[lane] as number];
        seen[lane] = (seen[lane] as number) + 1;
        return m?.a;
      });
      expect(order).toEqual(planned.map((m) => m.a));
      expect(lanes.every((l) => l.length > 0)).toBe(true);
    }
  });
});

describe('solver and metrics (GENERATOR.md §4–5)', () => {
  it('solve agrees with hand-checked levels', () => {
    expect(
      solve({ rows: RING, lanes: [[{ c: 'g', a: 1 }], [{ c: 'r', a: 8 }]], slots: 1 }, 1000),
    ).toBe('solvable');
    expect(
      solve(
        {
          rows: RING,
          lanes: [
            [
              { c: 'g', a: 1 },
              { c: 'r', a: 8 },
            ],
          ],
          slots: 1,
        },
        1000,
      ),
    ).toBe('unsolvable');
    expect(
      solve({ rows: RING, lanes: [[{ c: 'g', a: 1 }], [{ c: 'r', a: 8 }]], slots: 1 }, 0),
    ).toBe('unknown');
  });

  it('a level without choices is always won; a trap level is not', () => {
    const easy = { rows: ['rrrr'], lanes: [[{ c: 'r', a: 4 }]], slots: 5 };
    expect(randomWinRate(easy, 30, 1)).toBe(1);
    expect(greedyWins(easy)).toBe(true);
    expect(firstMoveTraps(easy)).toBe(0);
    const trap = { rows: RING, lanes: [[{ c: 'g', a: 1 }], [{ c: 'r', a: 8 }]], slots: 1 };
    const win = randomWinRate(trap, 200, 5);
    expect(win).toBeGreaterThan(0.3);
    expect(win).toBeLessThan(0.7);
    expect(greedyWins(trap)).toBe(true);
    expect(firstMoveTraps(trap)).toBe(1);
  });

  it('findLosingTaps finds a real losing order, or null when no order loses', () => {
    const trap = { rows: RING, lanes: [[{ c: 'g', a: 1 }], [{ c: 'r', a: 8 }]], slots: 1 };
    const taps = findLosingTaps(trap, 50, 1);
    expect(taps).not.toBeNull();
    expect(replay(trap, taps ?? []).status).toBe('lost');
    const easy = { rows: ['rrrr'], lanes: [[{ c: 'r', a: 4 }]], slots: 5 };
    expect(findLosingTaps(easy, 50, 1)).toBeNull();
  });

  it('clones are independent positions', () => {
    const g = new Game({ rows: RING, lanes: [[{ c: 'g', a: 1 }], [{ c: 'r', a: 8 }]], slots: 2 });
    const c = g.clone();
    c.tap(1);
    expect(g.taps).toBe(0);
    expect([...g.board.cells]).not.toEqual([...c.board.cells]);
  });

  it('clone copies every field of the game (none left undefined) and keeps no undo history', () => {
    const g = new Game({ rows: RING, lanes: [[{ c: 'g', a: 1 }], [{ c: 'r', a: 8 }]], slots: 2 });
    g.tap(0);
    const c = g.clone();
    expect(Object.keys(c).sort()).toEqual(Object.keys(g).sort());
    for (const [k, v] of Object.entries(c)) expect(v, k).not.toBeUndefined();
    expect(g.canUndo()).toBe(true);
    expect(c.canUndo()).toBe(false);
    c.tap(1);
    expect(c.status).toBe('won');
    expect(c.canUndo()).toBe(false);
  });
});

describe('bands (GENERATOR.md §6)', () => {
  it('targets rise by band and follow the sawtooth', () => {
    for (let i = 1; i < BANDS.length; i++) {
      expect((BANDS[i]?.target[0] ?? 0) > (BANDS[i - 1]?.target[0] ?? 0)).toBe(true);
    }
    expect(bandFor(1).from).toBe(1);
    expect(bandFor(61).from).toBe(61);
    expect(targetFor(15)[0]).toBeLessThan(targetFor(14)[0]);
    expect(targetFor(20)[0]).toBeGreaterThan(targetFor(19)[0]);
    for (const b of BANDS) expect(b.waitBudget).toBeLessThanOrEqual(SLOTS - 1);
  });

  it('the second round deals harder, within the level format', () => {
    for (const b of BANDS) {
      const e = escalate(b, MAX_LANES, SLOTS);
      expect(e.target).toEqual(b.target);
      expect(e.appetiteMin).toBe(b.appetiteMin);
      expect(e.waitBudget).toBeGreaterThanOrEqual(b.waitBudget);
      expect(e.waitBudget).toBeLessThanOrEqual(SLOTS - 1);
      expect(e.pWait).toBeGreaterThan(b.pWait);
      expect(e.runChance).toBeGreaterThan(b.runChance);
      expect(e.runChance).toBeLessThan(1);
      e.lanes.forEach((n, i) => {
        expect(n).toBeGreaterThanOrEqual(b.lanes[i] as number);
        expect(n).toBeLessThanOrEqual(MAX_LANES);
      });
    }
  });

  it('planning peaks: every 10th level from 20 on', () => {
    const peaks = Array.from({ length: 100 }, (_, i) => i + 1).filter(isPlanningPeak);
    expect(peaks).toEqual([20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });
});

function paramsOf(band: (typeof BANDS)[number] | undefined): {
  lanes: number;
  runChance: number;
  slots: number;
  appetiteMin: number;
  appetiteMax: number;
  waitBudget: number;
  pWait: number;
} {
  if (!band) throw new Error('no band');
  return {
    lanes: band.lanes[0] as number,
    runChance: band.runChance,
    slots: SLOTS,
    appetiteMin: band.appetiteMin,
    appetiteMax: band.appetiteMax,
    waitBudget: band.waitBudget,
    pWait: band.pWait,
  };
}
