import { countByColour, parsePicture } from '../core/board';
import { replay, type MuncherSpec } from '../core/game';
import { MAX_COLOURS, PALETTE } from '../data/palette';

/** Measured difficulty of a level (GENERATOR.md §5). */
export interface LevelMetrics {
  /** Share of seeded random playouts won (0..1). */
  randomWin: number;
  /** 1 − randomWin: the main difficulty signal. */
  difficulty: number;
  /** A careful (greedy) player wins. */
  greedyWin: boolean;
  /** Most slots the stored solution occupies at once. */
  peakSlots: number;
  /** Legal first taps that lead to a lost position; null when the search hit its node limit. */
  firstMoveTraps: number | null;
  /** Munchers in the level. */
  taps: number;
}

/** One level of the list (GENERATOR.md §1). */
export interface Level {
  id: number;
  snack: string;
  rows: string[];
  lanes: MuncherSpec[][];
  slots: number;
  face: number;
  solution: number[];
  metrics: LevelMetrics;
}

/** Snack grid sides, in cells (outline included): small enough to read on a phone. */
export const MIN_SIDE = 6;
export const MAX_SIDE = 20;
/** Dens per level: at least a choice, at most what fits across a portrait screen. */
export const MIN_LANES = 2;
export const MAX_LANES = 5;
/** Waiting slots in v0.1 (GDD §2; the +1 slot booster adds one during play). */
export const SLOTS = 5;

/**
 * Checks the invariants of GENERATOR.md §1; returns the problems (empty = valid). The solution
 * must replay to a win through the real rules, without boosters, within the slots.
 */
export function validateLevel(level: Omit<Level, 'metrics' | 'id' | 'face'>): string[] {
  const problems: string[] = [];
  const { rows, lanes, slots } = level;
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  if (h < MIN_SIDE || h > MAX_SIDE || w < MIN_SIDE || w > MAX_SIDE) {
    problems.push(
      `size ${String(w)}×${String(h)} outside ${String(MIN_SIDE)}..${String(MAX_SIDE)}`,
    );
  }
  if (rows.some((r) => r.length !== w)) problems.push('ragged rows');
  if (lanes.length < MIN_LANES || lanes.length > MAX_LANES) {
    problems.push(`${String(lanes.length)} lanes`);
  }
  if (lanes.some((l) => l.length === 0)) problems.push('an empty lane');
  if (slots !== SLOTS) problems.push(`${String(slots)} slots`);
  let parsed;
  try {
    parsed = parsePicture(rows);
  } catch (e) {
    return [...problems, `picture: ${String(e)}`];
  }
  const { board, keys } = parsed;
  if (keys.length > MAX_COLOURS) problems.push(`${String(keys.length)} colours`);
  for (const k of keys) if (PALETTE[k] === undefined) problems.push(`unknown colour ${k}`);
  const counts = countByColour(board, keys.length);
  const appetite = new Array<number>(keys.length).fill(0);
  for (const lane of lanes) {
    for (const m of lane) {
      const c = keys.indexOf(m.c);
      if (c === -1) problems.push(`muncher colour ${m.c} not in the picture`);
      else appetite[c] = (appetite[c] as number) + m.a;
      if (!Number.isInteger(m.a) || m.a < 1) problems.push(`appetite ${String(m.a)}`);
    }
  }
  keys.forEach((k, c) => {
    if (appetite[c] !== counts[c]) {
      problems.push(`colour ${k}: appetites ${String(appetite[c])} ≠ pixels ${String(counts[c])}`);
    }
  });
  if (problems.length > 0) return problems;
  const run = replay(level, level.solution);
  if (!run.legal) problems.push('the solution makes an illegal tap');
  else if (run.status !== 'won') problems.push(`the solution ends ${run.status}`);
  if (run.peakSlots > slots) problems.push('the solution needs more slots than the level has');
  return problems;
}
