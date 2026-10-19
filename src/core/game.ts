import {
  EATEN,
  cloneBoard,
  openGround,
  parsePicture,
  pixelsLeft,
  reachable,
  type Board,
} from './board';

/**
 * The rules of a level (GENERATOR.md §2): lanes of munchers, waiting slots, taps and the resolve
 * loop that lets every seated muncher eat what it can reach. Pure and deterministic; every change
 * is reported as events in order, so the scene can animate exactly what the rules did.
 */

/** One muncher as stored in a level: palette key and appetite. */
export interface MuncherSpec {
  c: string;
  a: number;
}

/** What the rules need from a level (the full Level type lives in src/gen). */
export interface LevelRules {
  rows: readonly string[];
  lanes: readonly (readonly MuncherSpec[])[];
  slots: number;
}

/** A muncher sitting in a slot. */
export interface Seated {
  /** Colour index (into `Game.keys`). */
  colour: number;
  appetite: number;
  remaining: number;
  lane: number;
  /** Position in its lane (0 = was the front at the start). */
  index: number;
  /** Bites taken since it sat down, across waits (the n of the next bite is eaten + 1). */
  eaten: number;
  /** It sat down unable to finish, and has not eaten since (GDD §3a waiting face). */
  waiting: boolean;
}

export type GameEvent =
  | { kind: 'hop'; lane: number; index: number; slot: number }
  | { kind: 'wake'; slot: number }
  | { kind: 'bite'; slot: number; cell: number; n: number; last: boolean }
  | { kind: 'full'; slot: number }
  | { kind: 'wait'; slot: number }
  | { kind: 'won' }
  | { kind: 'lost' };

export type Status = 'playing' | 'won' | 'lost';
export type TapResult = 'ok' | 'no-slot' | 'empty-lane' | 'over';

/** Boosters per level (GDD §7); rule constants live with the rules. */
export const EXTRA_SLOTS_PER_LEVEL = 1;
export const UNDOS_PER_LEVEL = 3;

interface Snapshot {
  cells: Int8Array;
  fronts: number[];
  slots: (Seated | null)[];
  status: Status;
  peakSlots: number;
}

export class Game {
  readonly keys: string[];
  /** Lanes as colour indices and appetites. */
  readonly lanes: { colour: number; appetite: number }[][];
  board: Board;
  fronts: number[];
  slots: (Seated | null)[];
  status: Status = 'playing';
  extraSlotsUsed = 0;
  undosUsed = 0;
  taps = 0;
  /** Most slots occupied at once (right after a muncher sat down). */
  peakSlots = 0;
  private readonly history: Snapshot[] = [];
  /** Player games keep undo snapshots; the generator, the solver and playouts do not need them. */
  private readonly keepHistory: boolean;

  constructor(level: LevelRules, opts: { history?: boolean } = {}) {
    this.keepHistory = opts.history ?? true;
    const parsed = parsePicture(level.rows);
    this.keys = parsed.keys;
    this.board = parsed.board;
    this.lanes = level.lanes.map((lane) =>
      lane.map((m) => {
        const colour = this.keys.indexOf(m.c);
        if (colour === -1) throw new Error(`muncher colour ${m.c} is not in the picture`);
        if (!Number.isInteger(m.a) || m.a < 1) throw new Error(`bad appetite ${String(m.a)}`);
        return { colour, appetite: m.a };
      }),
    );
    this.fronts = this.lanes.map(() => 0);
    this.slots = new Array<Seated | null>(level.slots).fill(null);
  }

  /**
   * Generator only (src/gen/generate.ts plans a solution by growing one lane while it plays it):
   * appends a muncher to the back of a lane. Not undoable (the generator never undoes).
   */
  append(lane: number, m: MuncherSpec): void {
    const colour = this.keys.indexOf(m.c);
    const l = this.lanes[lane];
    if (!l || colour === -1 || !Number.isInteger(m.a) || m.a < 1) {
      throw new Error(`cannot append ${m.c}${String(m.a)} to lane ${String(lane)}`);
    }
    l.push({ colour, appetite: m.a });
  }

  /**
   * An independent copy of the position (search and playouts), without undo history. Built
   * without the constructor (no re-parse of the picture); tests/gen.test.ts checks that every
   * field is copied, so a new field cannot be forgotten here silently.
   */
  clone(): Game {
    const g = Object.create(Game.prototype) as Game;
    Object.assign(g, {
      keys: this.keys,
      lanes: this.lanes.map((l) => [...l]),
      board: cloneBoard(this.board),
      fronts: [...this.fronts],
      slots: this.slots.map((s) => (s ? { ...s } : null)),
      status: this.status,
      extraSlotsUsed: this.extraSlotsUsed,
      undosUsed: this.undosUsed,
      taps: this.taps,
      peakSlots: this.peakSlots,
      history: [],
      keepHistory: false,
    });
    return g;
  }

  /** The muncher at the front of a lane, or null when the lane is empty. */
  front(lane: number): { colour: number; appetite: number } | null {
    const l = this.lanes[lane];
    const i = this.fronts[lane];
    if (!l || i === undefined) return null;
    return l[i] ?? null;
  }

  lanesLeft(): number {
    return this.lanes.reduce((n, l, i) => n + (l.length - (this.fronts[i] as number)), 0);
  }

  freeSlot(): number {
    return this.slots.indexOf(null);
  }

  /**
   * What a tap on this lane would do, without doing it. `no-slot` is a guard only: after every
   * resolve, full slots with munchers left in the dens mean the level is lost (`over`), so a
   * playing level always has a free slot (docs/questions.md, audit 2026-10-19).
   */
  check(lane: number): TapResult {
    if (this.status !== 'playing') return 'over';
    if (!this.front(lane)) return 'empty-lane';
    if (this.freeSlot() === -1) return 'no-slot';
    return 'ok';
  }

  /** Taps a lane: its front muncher sits in the leftmost free slot, then everyone eats. */
  tap(lane: number): { result: TapResult; events: GameEvent[] } {
    const result = this.check(lane);
    if (result !== 'ok') return { result, events: [] };
    if (this.keepHistory) this.history.push(this.snapshot());
    const spec = this.front(lane) as { colour: number; appetite: number };
    const slot = this.freeSlot();
    const index = this.fronts[lane] as number;
    this.fronts[lane] = index + 1;
    this.slots[slot] = {
      colour: spec.colour,
      appetite: spec.appetite,
      remaining: spec.appetite,
      lane,
      index,
      eaten: 0,
      waiting: false,
    };
    this.taps += 1;
    this.peakSlots = Math.max(this.peakSlots, this.slots.filter((s) => s !== null).length);
    const events: GameEvent[] = [{ kind: 'hop', lane, index, slot }];
    this.resolve(events);
    return { result, events };
  }

  /**
   * Every seated muncher eats what it can reach, left to right, until a full pass changes
   * nothing (GENERATOR.md §2). A muncher that just sat down is not waiting yet, so it never
   * "wakes"; one that sat waiting from an earlier turn does.
   */
  private resolve(events: GameEvent[]): void {
    // Open ground changes only when something is eaten, so it is recomputed only then.
    let open = openGround(this.board);
    for (;;) {
      let changed = false;
      for (let s = 0; s < this.slots.length; s++) {
        const m = this.slots[s];
        if (!m) continue;
        const order = reachable(this.board, m.colour, open);
        const k = Math.min(m.remaining, order.length);
        if (k === 0) continue;
        if (m.waiting) {
          m.waiting = false;
          events.push({ kind: 'wake', slot: s });
        }
        for (let b = 0; b < k; b++) {
          const cell = order[b] as number;
          this.board.cells[cell] = EATEN;
          m.eaten += 1;
          m.remaining -= 1;
          events.push({ kind: 'bite', slot: s, cell, n: m.eaten, last: m.remaining === 0 });
        }
        if (m.remaining === 0) {
          this.slots[s] = null;
          events.push({ kind: 'full', slot: s });
        }
        open = openGround(this.board);
        changed = true;
      }
      if (!changed) break;
    }
    // A muncher still hungry after the pass sits waiting (the one that just sat down included).
    for (let s = 0; s < this.slots.length; s++) {
      const m = this.slots[s];
      if (m && !m.waiting) {
        m.waiting = true;
        events.push({ kind: 'wait', slot: s });
      }
    }
    if (pixelsLeft(this.board) === 0) {
      this.status = 'won';
      events.push({ kind: 'won' });
    } else if (this.freeSlot() === -1 && this.lanesLeft() > 0) {
      this.status = 'lost';
      events.push({ kind: 'lost' });
    }
  }

  /** Booster: one more empty slot at the right end (GDD §7). Works on a lost level too. */
  addSlot(): boolean {
    if (this.status === 'won' || this.extraSlotsUsed >= EXTRA_SLOTS_PER_LEVEL) return false;
    this.extraSlotsUsed += 1;
    this.slots.push(null);
    if (this.status === 'lost') this.status = 'playing';
    return true;
  }

  canUndo(): boolean {
    return this.status !== 'won' && this.history.length > 0 && this.undosUsed < UNDOS_PER_LEVEL;
  }

  /** Booster: back to the moment before the last tap. Extra slots already bought stay. */
  undo(): boolean {
    if (!this.canUndo()) return false;
    const snap = this.history.pop() as Snapshot;
    this.undosUsed += 1;
    this.board = { w: this.board.w, h: this.board.h, cells: snap.cells };
    this.fronts = snap.fronts;
    const slots = snap.slots;
    while (slots.length < this.slots.length) slots.push(null);
    this.slots = slots;
    this.status = snap.status;
    this.peakSlots = snap.peakSlots;
    this.taps -= 1;
    return true;
  }

  private snapshot(): Snapshot {
    return {
      cells: cloneBoard(this.board).cells,
      fronts: [...this.fronts],
      slots: this.slots.map((s) => (s ? { ...s } : null)),
      status: this.status,
      peakSlots: this.peakSlots,
    };
  }
}

/** Plays a tap sequence; illegal taps stop the replay (GENERATOR.md §4, proof of solvability). */
export function replay(
  level: LevelRules,
  taps: readonly number[],
): { status: Status; peakSlots: number; legal: boolean; game: Game } {
  const game = new Game(level);
  for (const lane of taps) {
    if (game.tap(lane).result !== 'ok')
      return { status: game.status, peakSlots: game.peakSlots, legal: false, game };
  }
  return { status: game.status, peakSlots: game.peakSlots, legal: true, game };
}
