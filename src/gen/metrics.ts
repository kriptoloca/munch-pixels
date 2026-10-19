import { openGround, reachable } from '../core/board';
import { Game, type LevelRules } from '../core/game';
import type { LevelMetrics } from './level';
import { Rng } from './rng';
import { solveFrom } from './solve';

/** Node limit of the exact search behind `firstMoveTraps`, per first move. */
export const TRAP_NODE_LIMIT = 4000;

/**
 * A player who taps a uniformly random legal lane until the level ends; won or not. `taps`, when
 * given, receives the lanes tapped (the dev hook that looks for a losing order).
 */
export function randomPlayout(rules: LevelRules | Game, rng: Rng, taps?: number[]): boolean {
  const g = rules instanceof Game ? rules.clone() : new Game(rules, { history: false });
  while (g.status === 'playing') {
    const legal: number[] = [];
    for (let lane = 0; lane < g.lanes.length; lane++) if (g.check(lane) === 'ok') legal.push(lane);
    if (legal.length === 0) return false;
    const lane = rng.pick(legal);
    taps?.push(lane);
    g.tap(lane);
  }
  return g.status === 'won';
}

export function randomWinRate(rules: LevelRules, playouts: number, seed: number): number {
  const rng = new Rng(seed);
  const start = new Game(rules, { history: false });
  let won = 0;
  for (let i = 0; i < playouts; i++) if (randomPlayout(start, rng)) won += 1;
  return won / playouts;
}

/**
 * A careful player (GENERATOR.md §5): prefers a front muncher that can eat its whole appetite
 * now, then one that can eat something, then any legal lane; ties go to the lowest lane.
 */
export function greedyWins(rules: LevelRules): boolean {
  const g = new Game(rules, { history: false });
  while (g.status === 'playing') {
    let best = -1;
    let bestScore = -1;
    const open = openGround(g.board);
    for (let lane = 0; lane < g.lanes.length; lane++) {
      if (g.check(lane) !== 'ok') continue;
      const m = g.front(lane);
      if (!m) continue;
      const reach = reachable(g.board, m.colour, open).length;
      const score = reach >= m.appetite ? 2 : reach > 0 ? 1 : 0;
      if (score > bestScore) {
        best = lane;
        bestScore = score;
      }
    }
    if (best === -1) return false;
    g.tap(best);
  }
  return g.status === 'won';
}

/** Legal first taps after which the level can no longer be won; null when any search was cut. */
export function firstMoveTraps(rules: LevelRules): number | null {
  const start = new Game(rules, { history: false });
  let traps = 0;
  for (let lane = 0; lane < start.lanes.length; lane++) {
    if (start.check(lane) !== 'ok') continue;
    const after = start.clone();
    after.tap(lane);
    const r = solveFrom(after, TRAP_NODE_LIMIT);
    if (r === 'unknown') return null;
    if (r === 'unsolvable') traps += 1;
  }
  return traps;
}

export function measure(
  rules: LevelRules,
  peakSlots: number,
  playouts: number,
  seed: number,
): LevelMetrics {
  const randomWin = randomWinRate(rules, playouts, seed);
  const taps = rules.lanes.reduce((n, l) => n + l.length, 0);
  return {
    randomWin,
    difficulty: Math.round((1 - randomWin) * 1000) / 1000,
    greedyWin: greedyWins(rules),
    peakSlots,
    firstMoveTraps: firstMoveTraps(rules),
    taps,
  };
}

/**
 * A tap order that loses the level (dev hook and e2e: the lose panel must be reachable through
 * real taps): the first lost random playout over `tries` seeds, or null.
 */
export function findLosingTaps(rules: LevelRules, tries: number, seed: number): number[] | null {
  const start = new Game(rules, { history: false });
  const rng = new Rng(seed);
  for (let t = 0; t < tries; t++) {
    const taps: number[] = [];
    if (!randomPlayout(start, rng, taps)) return taps;
  }
  return null;
}
