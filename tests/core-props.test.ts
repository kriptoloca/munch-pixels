import { describe, expect, it } from 'vitest';
import { countByColour, parsePicture } from '../src/core/board';
import { Game, replay, type LevelRules, type MuncherSpec } from '../src/core/game';
import { Rng } from '../src/gen/rng';

const KEYS = ['r', 'g', 'b', 'y'];

/** A random level with exact appetite totals: pictures with holes, odd shapes, 1–5 slots. */
function randomLevel(rng: Rng): LevelRules {
  const w = rng.int(1, 7);
  const h = rng.int(1, 7);
  const colours = rng.int(1, 4);
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++)
      r += rng.chance(0.2) ? '.' : (KEYS[rng.int(0, colours - 1)] as string);
    rows.push(r);
  }
  if (!rows.join('').replace(/\./g, '')) rows[0] = `r${(rows[0] as string).slice(1)}`;
  const { board, keys } = parsePicture(rows);
  const counts = countByColour(board, keys.length);
  const munchers: MuncherSpec[] = [];
  keys.forEach((k, c) => {
    let left = counts[c] as number;
    while (left > 0) {
      const a = rng.int(1, Math.min(4, left));
      munchers.push({ c: k, a });
      left -= a;
    }
  });
  rng.shuffle(munchers);
  const laneCount = rng.int(1, 3);
  const lanes: MuncherSpec[][] = Array.from({ length: laneCount }, () => []);
  munchers.forEach((m) => (lanes[rng.int(0, laneCount - 1)] as MuncherSpec[]).push(m));
  return { rows, lanes: lanes.filter((l) => l.length > 0), slots: rng.int(1, 5) };
}

function stateOf(g: Game): string {
  return JSON.stringify([[...g.board.cells], g.fronts, g.slots, g.status, g.peakSlots]);
}

describe('rules: properties over 2000 random levels (audit 2026-10-19)', () => {
  it('lost only with full slots; a playing level has a free slot; all munchers out ⇒ won', () => {
    const rng = new Rng(2026);
    for (let i = 0; i < 2000; i++) {
      const level = randomLevel(rng);
      const g = new Game(level);
      while (g.status === 'playing') {
        expect(g.freeSlot()).not.toBe(-1);
        const legal = g.lanes.flatMap((_, l) => (g.check(l) === 'ok' ? [l] : []));
        expect(legal.length).toBeGreaterThan(0);
        g.tap(rng.pick(legal));
      }
      if (g.status === 'lost') {
        expect(g.freeSlot()).toBe(-1);
        expect(g.lanesLeft()).toBeGreaterThan(0);
      }
      if (g.lanesLeft() === 0) expect(g.status).toBe('won');
      // munchers sitting with a slot still free never end a level
      for (const lane of g.lanes.keys()) expect(g.check(lane)).not.toBe('no-slot');
    }
  });

  it('undo gives exactly the position of replaying all taps but the last', () => {
    const rng = new Rng(77);
    for (let i = 0; i < 1500; i++) {
      const level = randomLevel(rng);
      const g = new Game(level);
      const taps: number[] = [];
      while (g.status === 'playing') {
        const legal = g.lanes.flatMap((_, l) => (g.check(l) === 'ok' ? [l] : []));
        const lane = rng.pick(legal);
        taps.push(lane);
        g.tap(lane);
      }
      if (taps.length === 0 || g.status === 'won') continue;
      expect(g.undo()).toBe(true);
      expect(stateOf(g)).toBe(stateOf(replay(level, taps.slice(0, -1)).game));
    }
  });

  it('any mix of taps, undos and +1 slot equals a replay of the taps still standing', () => {
    const rng = new Rng(4242);
    for (let i = 0; i < 1000; i++) {
      const level = randomLevel(rng);
      const g = new Game(level);
      const standing: number[] = [];
      for (let step = 0; step < 60; step++) {
        const r = rng.next();
        if (r < 0.15) {
          if (g.undo()) standing.pop();
        } else if (r < 0.25) {
          g.addSlot();
        } else if (g.status === 'playing') {
          const legal = g.lanes.flatMap((_, l) => (g.check(l) === 'ok' ? [l] : []));
          const lane = rng.pick(legal);
          expect(g.tap(lane).result).toBe('ok');
          standing.push(lane);
        }
        // an extra slot sits at the right end, so it changes nothing before it is needed
        const ref = replay({ ...level, slots: level.slots + g.extraSlotsUsed }, standing);
        expect(ref.legal).toBe(true);
        expect(stateOf(g), `level ${String(i)} step ${String(step)}`).toBe(stateOf(ref.game));
      }
    }
  });

  it('worked example 4 in detail: r3 eats the top row, g eats on the next tap, r5 the rest', () => {
    const level = {
      rows: ['rrr', 'rgr', 'rrr'],
      lanes: [[{ c: 'r', a: 3 }], [{ c: 'g', a: 1 }], [{ c: 'r', a: 5 }]],
      slots: 5,
    };
    const g = new Game(level);
    const cells = (e: ReturnType<Game['tap']>): number[] =>
      e.events.flatMap((x) => (x.kind === 'bite' ? [x.cell] : []));
    expect(cells(g.tap(0))).toEqual([0, 1, 2]);
    expect(cells(g.tap(1))).toEqual([4]);
    expect(cells(g.tap(2))).toEqual([3, 5, 6, 7, 8]);
    expect(g.status).toBe('won');
  });
});
