import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/game';
import {
  BITE_FLIGHT_MS,
  BITE_INTERVAL_MS,
  CRUMB_MS,
  FAST_FORWARD_MS,
  FULL_BOUNCE_MS,
  FULL_HIT_STOP_MS,
  HOP_MS,
  HOP_SQUASH_MS,
  LEAVE_MS,
  STUCK_MS,
  STUCK_STAGGER_MS,
  WAKE_MS,
  WIN_BEAT_MS,
} from '../src/game/feel';
import { Timeline, cascade, type Action } from '../src/game/timeline';

const bite = (slot: number, cell: number, n: number, last = false): GameEvent => ({
  kind: 'bite',
  slot,
  cell,
  n,
  last,
});

function all(t: Timeline): Action[] {
  const out: Action[] = [];
  t.drain(Number.POSITIVE_INFINITY, (a) => out.push(a));
  return out;
}

describe('Timeline (GDD §3a playback)', () => {
  it('a tap: the hop, then the bites 70 ms apart once it landed, then the leave', () => {
    const t = new Timeline();
    t.add(
      [
        { kind: 'hop', lane: 0, index: 0, slot: 0 },
        bite(0, 1, 1),
        bite(0, 2, 2),
        bite(0, 3, 3, true),
        { kind: 'full', slot: 0 },
      ],
      1000,
    );
    const a = all(t);
    expect(a.map((x) => [x.kind, x.at])).toEqual([
      ['hop', 1000],
      ['bite', 1000 + HOP_MS],
      ['bite', 1000 + HOP_MS + BITE_INTERVAL_MS],
      ['bite', 1000 + HOP_MS + 2 * BITE_INTERVAL_MS],
      ['full', 1000 + HOP_MS + 2 * BITE_INTERVAL_MS + BITE_FLIGHT_MS],
    ]);
    expect(a.every((x) => !x.fast)).toBe(true);
  });

  it('a chain: the wake comes after the bites that opened it; waits sit at the last landing', () => {
    const t = new Timeline();
    t.add(
      [
        { kind: 'hop', lane: 1, index: 0, slot: 1 },
        bite(1, 5, 1),
        bite(1, 6, 2, true),
        { kind: 'full', slot: 1 },
        { kind: 'wake', slot: 0 },
        bite(0, 7, 3),
        { kind: 'wait', slot: 0 },
      ],
      0,
    );
    const a = all(t);
    const at = (k: string, slot?: number): number =>
      a.find((x) => x.kind === k && (slot === undefined || ('slot' in x && x.slot === slot)))?.at ??
      -1;
    const lastOpener = HOP_MS + BITE_INTERVAL_MS;
    expect(at('wake', 0)).toBe(lastOpener + BITE_INTERVAL_MS);
    expect(at('bite', 0)).toBe(at('wake', 0) + WAKE_MS);
    expect(at('wait', 0)).toBe(at('bite', 0) + BITE_FLIGHT_MS);
    expect(at('full', 1)).toBe(lastOpener + BITE_FLIGHT_MS);
    // drained in time order
    expect(a.map((x) => x.at)).toEqual([...a.map((x) => x.at)].sort((p, q) => p - q));
  });

  it('won and lost wait for everything to land, then their own beat', () => {
    const t = new Timeline();
    t.add(
      [
        { kind: 'hop', lane: 0, index: 0, slot: 0 },
        bite(0, 1, 1, true),
        { kind: 'full', slot: 0 },
        { kind: 'won' },
      ],
      0,
    );
    const won = all(t).find((x) => x.kind === 'won');
    expect(won?.at).toBe(HOP_MS + BITE_FLIGHT_MS + WIN_BEAT_MS);
    t.add(
      [{ kind: 'hop', lane: 0, index: 1, slot: 0 }, { kind: 'wait', slot: 0 }, { kind: 'lost' }],
      0,
    );
    const lost = all(t).find((x) => x.kind === 'lost');
    expect(lost?.at).toBe(HOP_MS + STUCK_MS);
  });

  it('a lost tap: the faces turn down slot by slot from the last sit-down, the panel STUCK_MS later', () => {
    const t = new Timeline();
    t.reset(['0:0', '1:0', '0:1', '2:0', null]);
    t.add(
      [{ kind: 'hop', lane: 2, index: 1, slot: 4 }, { kind: 'wait', slot: 4 }, { kind: 'lost' }],
      100,
    );
    const a = all(t);
    expect(a.map((x) => x.kind)).toEqual([
      'hop',
      'wait',
      'stuck',
      'stuck',
      'stuck',
      'stuck',
      'stuck',
      'lost',
    ]);
    const stuck = a.filter((x) => x.kind === 'stuck');
    const beat = 100 + HOP_MS;
    expect(stuck.map((x) => [x.who, x.kind === 'stuck' ? x.slot : -1, x.at])).toEqual([
      ['0:0', 0, beat],
      ['1:0', 1, beat + STUCK_STAGGER_MS],
      ['0:1', 2, beat + 2 * STUCK_STAGGER_MS],
      ['2:0', 3, beat + 3 * STUCK_STAGGER_MS],
      ['2:1', 4, beat + 4 * STUCK_STAGGER_MS],
    ]);
    expect(stuck.map((x) => (x.kind === 'stuck' ? x.k : -1))).toEqual([0, 1, 2, 3, 4]);
    expect(a.find((x) => x.kind === 'lost')?.at).toBe(beat + STUCK_MS);
  });

  it('a new tap squeezes what is still playing into the fast-forward window, in order', () => {
    const t = new Timeline();
    const long: GameEvent[] = [{ kind: 'hop', lane: 0, index: 0, slot: 0 }];
    for (let i = 1; i <= 20; i++) long.push(bite(0, i, i, i === 20));
    long.push({ kind: 'full', slot: 0 });
    t.add(long, 0);
    const played: Action[] = [];
    t.drain(250, (a) => played.push(a));
    expect(played.map((a) => a.kind)).toEqual(['hop', 'bite']);
    t.add(
      [
        { kind: 'hop', lane: 1, index: 0, slot: 0 },
        bite(0, 30, 1, true),
        { kind: 'full', slot: 0 },
      ],
      250,
    );
    const rest = all(t);
    const old = rest.filter((x) => x.fast);
    expect(old).toHaveLength(20);
    expect(old.every((a) => a.fast && a.at > 250 && a.at <= 250 + FAST_FORWARD_MS)).toBe(true);
    expect(old.map((a) => (a.kind === 'bite' ? a.cell : 'full'))).toEqual([
      ...Array.from({ length: 19 }, (_, i) => i + 2),
      'full',
    ]);
    // the new muncher hops at once and lands after the old one has left
    const hop = rest.find((a) => a.kind === 'hop');
    expect(hop?.at).toBe(250);
    expect(rest.find((a) => a.kind === 'bite' && a.cell === 30)?.at).toBe(250 + HOP_MS);
    expect(250 + FAST_FORWARD_MS).toBeLessThan(250 + HOP_MS);
  });

  it('drain plays nothing early; flush plays everything, fast', () => {
    const t = new Timeline();
    t.add(
      [{ kind: 'hop', lane: 0, index: 0, slot: 0 }, bite(0, 1, 1, true), { kind: 'full', slot: 0 }],
      0,
    );
    const early: Action[] = [];
    t.drain(HOP_MS - 1, (a) => early.push(a));
    expect(early.map((a) => a.kind)).toEqual(['hop']);
    expect(t.pending).toBe(2);
    const rest: Action[] = [];
    t.flush((a) => rest.push(a));
    expect(rest.map((a) => [a.kind, a.fast])).toEqual([
      ['bite', true],
      ['full', true],
    ]);
    expect(t.pending).toBe(0);
  });

  it('slot events name their muncher, so a reused slot never mixes up two munchers', () => {
    const t = new Timeline();
    t.add(
      [
        { kind: 'hop', lane: 0, index: 0, slot: 0 },
        bite(0, 1, 1),
        bite(0, 2, 2, true),
        { kind: 'full', slot: 0 },
      ],
      0,
    );
    // the next tap reuses slot 0 while the first muncher's meal is still on screen
    t.add(
      [
        { kind: 'hop', lane: 1, index: 0, slot: 0 },
        { kind: 'wait', slot: 0 },
      ],
      10,
    );
    const a = all(t);
    const full = a.find((x) => x.kind === 'full');
    const hop2 = a.find((x) => x.kind === 'hop' && x.lane === 1);
    expect(full?.who).toBe('0:0');
    expect(hop2?.who).toBe('1:0');
    expect(a.find((x) => x.kind === 'wait')?.who).toBe('1:0');
    expect(a.filter((x) => x.kind === 'bite').every((x) => x.who === '0:0')).toBe(true);
    // the new muncher hops at once; the old one's leave is squeezed, not reassigned
    expect(hop2?.at).toBe(10);
    expect(full?.fast).toBe(true);
  });

  it("reset starts from the rules' seats", () => {
    const t = new Timeline();
    t.reset([null, '2:3']);
    t.add([{ kind: 'wake', slot: 1 }, bite(1, 4, 5, true), { kind: 'full', slot: 1 }], 0);
    expect(all(t).map((x) => x.who)).toEqual(['2:3', '2:3', '2:3']);
  });
});

describe('cascade (D5)', () => {
  it("a tap's cascade is its own motion: the win reveal and the stuck beat are the level's beats", () => {
    // the last tap of a lost level: a hop, a sit-down, then the stuck beat and the panel
    const lost = cascade([
      { kind: 'hop', lane: 0, index: 1, slot: 0 },
      { kind: 'wait', slot: 0 },
      { kind: 'lost' },
    ]);
    expect(lost.ms).toBe(HOP_MS + HOP_SQUASH_MS);
    // the next input still waits for the panel (drained counts the beats)
    expect(lost.drained).toBe(HOP_MS + STUCK_MS);
    // the last tap of a won level: the meal's motion and its hit stop, not the win beat after it
    const won = cascade([
      { kind: 'hop', lane: 0, index: 0, slot: 0 },
      bite(0, 1, 1, true),
      { kind: 'full', slot: 0 },
      { kind: 'won' },
    ]);
    const meal = HOP_MS + BITE_FLIGHT_MS + FULL_BOUNCE_MS + LEAVE_MS;
    expect(meal).toBeGreaterThan(HOP_MS + CRUMB_MS);
    expect(won.ms).toBe(meal + FULL_HIT_STOP_MS);
    // the next input waits for the win (its beat, after the meal's hit stop)
    expect(won.drained).toBe(HOP_MS + BITE_FLIGHT_MS + WIN_BEAT_MS + FULL_HIT_STOP_MS);
  });
});
