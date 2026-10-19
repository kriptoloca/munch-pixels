import { describe, expect, it } from 'vitest';
import {
  EATEN,
  EMPTY,
  countByColour,
  isExposed,
  openGround,
  parsePicture,
  pixelsLeft,
  reachable,
} from '../src/core/board';
import {
  EXTRA_SLOTS_PER_LEVEL,
  Game,
  UNDOS_PER_LEVEL,
  replay,
  type GameEvent,
  type LevelRules,
} from '../src/core/game';

const RING = ['rrr', 'rgr', 'rrr'];
const HOLE = ['rrrr', 'r.gr', 'rrrr'];

function level(rows: string[], lanes: string[][], slots = 5): LevelRules {
  return {
    rows,
    lanes: lanes.map((l) => l.map((m) => ({ c: m[0] as string, a: Number(m.slice(1)) }))),
    slots,
  };
}

const kinds = (events: GameEvent[]): string[] => events.map((e) => e.kind);
const bites = (events: GameEvent[]): number[] =>
  events.flatMap((e) => (e.kind === 'bite' ? [e.cell] : []));

describe('board (GENERATOR.md §2)', () => {
  it('parses colours in order of first appearance and transparent cells', () => {
    const { board, keys } = parsePicture(['.rg', 'gr.']);
    expect(keys).toEqual(['r', 'g']);
    expect([...board.cells]).toEqual([EMPTY, 0, 1, 1, 0, EMPTY]);
    expect(pixelsLeft(board)).toBe(4);
    expect(countByColour(board, 2)).toEqual([2, 2]);
    expect(() => parsePicture(['rr', 'r'])).toThrow();
  });

  it('an enclosed hole is not open ground until something next to it is eaten', () => {
    const { board } = parsePicture(HOLE);
    const hole = 1 * 4 + 1;
    const g = 1 * 4 + 2;
    expect(openGround(board)[hole]).toBe(0);
    expect(isExposed(board, openGround(board), g)).toBe(false);
    board.cells[1] = EATEN; // (1,0) above the hole
    expect(openGround(board)[hole]).toBe(1);
    expect(isExposed(board, openGround(board), g)).toBe(true);
  });

  it('border pixels are exposed; a buried centre is not', () => {
    const { board } = parsePicture(RING);
    const open = openGround(board);
    expect(isExposed(board, open, 0)).toBe(true);
    expect(isExposed(board, open, 4)).toBe(false);
  });

  it('reachable: exposed pixels first in row-major order, then breadth-first in the colour', () => {
    const { board } = parsePicture(['.....', '.rrr.', '.rgr.', '.rrr.', '.....']);
    // every r touches open ground, so the order is plain row-major
    expect(reachable(board, 0)).toEqual([6, 7, 8, 11, 13, 16, 17, 18]);
    expect(reachable(board, 1)).toEqual([]);
    // a colour reached only through itself: the inner b pixels follow the outer ones
    const deep = parsePicture(['bbb', 'bgb', 'bbb', 'bbb']).board;
    expect(reachable(deep, 0)).toHaveLength(11);
  });

  it('munchers tunnel through their own colour, never through another', () => {
    const { board } = parsePicture(['ggggg', 'grrrg', 'grbrg', 'grrrg', 'ggggg']);
    expect(reachable(board, 1)).toEqual([]); // r is walled in by g
    expect(reachable(board, 2)).toEqual([]);
    expect(reachable(board, 0)).toHaveLength(16);
  });
});

describe('game: the worked examples (GENERATOR.md §2)', () => {
  it('1 · ring with a buried centre: g waits, r eats the ring, g wakes on the same resolve', () => {
    const game = new Game(level(RING, [['g1'], ['r8']]));
    const first = game.tap(0);
    expect(first.result).toBe('ok');
    expect(kinds(first.events)).toEqual(['hop', 'wait']);
    expect(game.slots[0]?.waiting).toBe(true);
    const second = game.tap(1);
    expect(kinds(second.events)).toEqual([
      'hop',
      ...new Array<string>(7).fill('bite'),
      'bite',
      'full',
      'wake',
      'bite',
      'full',
      'won',
    ]);
    expect(game.status).toBe('won');
    expect(bites(second.events).at(-1)).toBe(4);
  });

  it('2 · the same with one slot: g first blocks the slot and loses; r first wins', () => {
    const bad = new Game(level(RING, [['g1'], ['r8']], 1));
    expect(kinds(bad.tap(0).events)).toEqual(['hop', 'wait', 'lost']);
    expect(bad.status).toBe('lost');
    expect(bad.tap(1).result).toBe('over');
    const good = replay(level(RING, [['g1'], ['r8']], 1), [1, 0]);
    expect(good.status).toBe('won');
    expect(good.peakSlots).toBe(1);
  });

  it('3 · hole: eating (1,0) opens the hole, the waiting g eats on the same resolve', () => {
    const game = new Game(level(HOLE, [['g1'], ['r3', 'r7']]));
    game.tap(0);
    const r3 = game.tap(1);
    expect(bites(r3.events)).toEqual([0, 1, 2, 6]); // r3 eats (0,0) (1,0) (2,0), then g at (2,1)
    expect(kinds(r3.events)).toEqual([
      'hop',
      'bite',
      'bite',
      'bite',
      'full',
      'wake',
      'bite',
      'full',
    ]);
    const r7 = game.tap(1);
    expect(r7.events.filter((e) => e.kind === 'bite')).toHaveLength(7);
    expect(game.status).toBe('won');
  });

  it('4 · appetite larger than reach: r3 opens the top, g eats next, r5 eats the rest', () => {
    const run = replay(level(RING, [['r3'], ['g1'], ['r5']]), [0, 1, 2]);
    expect(run.status).toBe('won');
    expect(run.legal).toBe(true);
  });
});

describe('game: rules', () => {
  it('a muncher that cannot finish eats what it reaches, then waits with the rest', () => {
    const game = new Game(level(RING, [['r3', 'r5'], ['g1']]));
    // r3 then r5: the second r eats the remaining 5 ring cells
    game.tap(0);
    game.tap(0);
    const g = game.tap(1);
    expect(kinds(g.events)).toEqual(['hop', 'bite', 'full', 'won']);
  });

  it('bite numbers count up within a meal and the last bite is marked', () => {
    const game = new Game(level(RING, [['r8'], ['g1']]));
    const { events } = game.tap(0);
    const ns = events.flatMap((e) => (e.kind === 'bite' ? [[e.n, e.last ? 1 : 0]] : []));
    expect(ns).toEqual([
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
      [6, 0],
      [7, 0],
      [8, 1],
    ]);
  });

  it('a tap with no free slot does nothing; an empty lane does nothing', () => {
    const game = new Game(level(RING, [['g1'], ['r4', 'r4']], 1));
    expect(game.tap(0).result).toBe('ok'); // g waits → lost (1 slot, lanes left)
    const fresh = new Game(level(['rg'], [['r1', 'g1']], 1));
    expect(fresh.tap(0).result).toBe('ok');
    expect(fresh.tap(0).result).toBe('ok');
    expect(fresh.status).toBe('won');
    expect(fresh.tap(0).result).toBe('over');
    const two = new Game(level(RING, [['g1'], ['r8']], 2));
    two.tap(0);
    expect(two.check(0)).toBe('empty-lane');
  });

  it('lose only when every slot is blocked and munchers are still in the dens', () => {
    const game = new Game(level(RING, [['g1'], ['r8']], 1));
    game.tap(0);
    expect(game.status).toBe('lost');
    // with all munchers out the level always finishes (exact totals)
    const all = replay(level(RING, [['g1'], ['r8']], 2), [0, 1]);
    expect(all.status).toBe('won');
  });

  it('rejects muncher colours that are not in the picture and bad appetites', () => {
    expect(() => new Game(level(RING, [['b1']]))).toThrow();
    expect(() => new Game(level(RING, [['r0']]))).toThrow();
  });
});

describe('game: boosters', () => {
  it('+1 slot rescues a lost level once', () => {
    const game = new Game(level(RING, [['g1'], ['r8']], 1));
    game.tap(0);
    expect(game.status).toBe('lost');
    expect(game.addSlot()).toBe(true);
    expect(game.status).toBe('playing');
    expect(game.slots).toHaveLength(2);
    game.tap(1);
    expect(game.status).toBe('won');
    expect(EXTRA_SLOTS_PER_LEVEL).toBe(1);
    expect(game.addSlot()).toBe(false);
  });

  it('undo restores the board, the dens and the slots exactly, and keeps a bought slot', () => {
    const game = new Game(level(HOLE, [['g1'], ['r3', 'r7']], 2));
    game.tap(0);
    const before = {
      cells: [...game.board.cells],
      fronts: [...game.fronts],
      slots: JSON.stringify(game.slots),
    };
    game.tap(1);
    game.addSlot();
    expect(game.undo()).toBe(true);
    expect([...game.board.cells]).toEqual(before.cells);
    expect(game.fronts).toEqual(before.fronts);
    expect(JSON.stringify(game.slots.slice(0, 2))).toBe(before.slots);
    expect(game.slots).toHaveLength(3);
    expect(game.taps).toBe(1);
  });

  it('undo is limited per level and impossible after a win', () => {
    const game = new Game(level(['rrrr'], [['r1', 'r1', 'r1', 'r1']]));
    for (let i = 0; i < UNDOS_PER_LEVEL; i++) {
      game.tap(0);
      expect(game.undo()).toBe(true);
    }
    game.tap(0);
    expect(game.undo()).toBe(false);
    const won = replay(level(['r'], [['r1']]), [0]).game;
    expect(won.undo()).toBe(false);
  });
});

describe('replay', () => {
  it('stops at an illegal tap', () => {
    const r = replay(level(RING, [['g1'], ['r8']], 1), [0, 1]);
    expect(r.legal).toBe(false);
    expect(r.status).toBe('lost');
  });
});
