import { SNACKS, type Picture } from '../data/snacks';
import { generate, type Generated } from './generate';
import { MAX_LANES, SLOTS, validateLevel, type Level } from './level';
import { greedyWins, measure, randomWinRate } from './metrics';
import {
  CANDIDATES_PER_LEVEL,
  LEVEL_COUNT,
  PLAYOUTS,
  LIGHT_SNACKS,
  METRIC_PLAYOUTS,
  OUTLINE_KEY,
  SNACK_CYCLE_FROM,
  SNACKS_IN_ORDER,
  bandFor,
  escalate,
  isBreather,
  isPlanningPeak,
  targetFor,
  type BandParams,
} from './params';
import { Rng, hashSeed } from './rng';

/**
 * Builds the level list (GENERATOR.md §6). Levels 1–30 meet the snacks in list order; later
 * levels cycle through the snacks from SNACK_CYCLE_FROM, the light ones on breathers only and the
 * rest everywhere else, mirrored on every other pass (`snackForLevel`). For each
 * level, up to CANDIDATES_PER_LEVEL seeds are generated and measured; the first hit wins (inside
 * the target, and lost by the greedy player on a planning peak), else the closest candidate. When
 * the closest one is still below the target, or a planning peak found no greedy loss, a second
 * round tries as many seeds again with harder dealing (`escalate`).
 */

export function mirror(rows: readonly string[]): string[] {
  return rows.map((r) => [...r].reverse().join(''));
}

/**
 * Wraps a picture in a one-pixel outline of `key` (the picture grows by one cell on each side):
 * every transparent cell that touches a pixel and is connected to the outside. Enclosed holes stay
 * holes (they open when something next to them is eaten, GENERATOR.md §2). The outline buries
 * every inner colour until it is eaten through, which is where the order of taps starts to
 * matter (docs/questions.md).
 */
export function outline(rows: readonly string[], key: string): string[] {
  const h = rows.length + 2;
  const w = (rows[0]?.length ?? 0) + 2;
  const at = (x: number, y: number): string => rows[y - 1]?.[x - 1] ?? '.';
  // Transparent cells reachable from the border of the grown grid (4-neighbourhood).
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (outside[i] === 1 || at(x, y) !== '.') return;
    outside[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const x = i % w;
    const y = (i - x) / w;
    push(x, y - 1);
    push(x - 1, y);
    push(x + 1, y);
    push(x, y + 1);
  }
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = '';
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      if (c !== '.') line += c;
      else {
        const touches =
          at(x, y - 1) !== '.' ||
          at(x - 1, y) !== '.' ||
          at(x + 1, y) !== '.' ||
          at(x, y + 1) !== '.';
        line += touches && outside[y * w + x] === 1 ? key : '.';
      }
    }
    out.push(line);
  }
  return out;
}

export function snackForLevel(level: number): { id: string; rows: string[] } {
  if (level <= SNACKS_IN_ORDER) {
    const direct = SNACKS[level - 1] as Picture;
    return { id: direct.id, rows: [...direct.rows] };
  }
  // The first snacks only teach (tiny, two or three colours); they never come back.
  const cycled = SNACKS.slice(SNACK_CYCLE_FROM);
  const light = cycled.filter((p) => LIGHT_SNACKS.includes(p.id));
  const heavy = cycled.filter((p) => !LIGHT_SNACKS.includes(p.id));
  // Count this level's position among the later levels of its kind (breather or not).
  let k = 0;
  for (let n = SNACKS_IN_ORDER + 1; n < level; n++) if (isBreather(n) === isBreather(level)) k += 1;
  const cycle = isBreather(level) ? light : heavy;
  const pick = cycle[k % cycle.length] as Picture;
  const pass = Math.floor(k / cycle.length);
  return pass % 2 === 0
    ? { id: `${pick.id}-m`, rows: mirror(pick.rows) }
    : { id: pick.id, rows: [...pick.rows] };
}

/**
 * Salts that give the lane count and the playouts their own random streams, apart from the
 * generator's (a shared first draw would tie the lane count to the first planned wait).
 */
const LANES_SALT = 0x2c1b3c6d;
const PLAYOUT_SALT = 0x5bd1e995;

function distance(d: number, [lo, hi]: [number, number]): number {
  if (d < lo) return lo - d;
  if (d > hi) return d - hi;
  return 0;
}

interface Candidate {
  gen: Generated;
  dist: number;
  /** A planning peak that the greedy player still wins (a miss; see `better`). */
  peakMiss: number;
  below: boolean;
}

/**
 * Ranking: the distance to the target first; on a planning peak the greedy loss comes first, since
 * it is what makes the level a planning level (a little off the target is the smaller miss).
 */
function better(a: Candidate, b: Candidate | null, planning: boolean): boolean {
  if (!b) return true;
  if (planning && a.peakMiss !== b.peakMiss) return a.peakMiss < b.peakMiss;
  if (a.dist !== b.dist) return a.dist < b.dist;
  return a.peakMiss < b.peakMiss;
}

function isHit(c: Candidate): boolean {
  return c.dist === 0 && c.peakMiss === 0;
}

/** Up to CANDIDATES_PER_LEVEL seeds with one band's dealing; stops at the first hit. */
function search(
  level: number,
  rows: readonly string[],
  band: BandParams,
  round: string,
  best: Candidate | null,
): Candidate | null {
  const target = targetFor(level);
  const planning = isPlanningPeak(level);
  for (let k = 0; k < CANDIDATES_PER_LEVEL; k++) {
    const seed = hashSeed(`level:${String(level)}:${round}${String(k)}`);
    const lanes = new Rng(seed ^ LANES_SALT).pick(band.lanes);
    const gen = generate(
      rows,
      {
        lanes,
        runChance: band.runChance,
        slots: SLOTS,
        appetiteMin: band.appetiteMin,
        appetiteMax: band.appetiteMax,
        waitBudget: band.waitBudget,
        pWait: band.pWait,
      },
      seed,
    );
    if (!gen) continue;
    const rules = { rows, lanes: gen.lanes, slots: SLOTS };
    const d = 1 - randomWinRate(rules, PLAYOUTS, seed ^ PLAYOUT_SALT);
    const c: Candidate = {
      gen,
      dist: distance(d, target),
      peakMiss: planning && greedyWins(rules) ? 1 : 0,
      below: d < target[0],
    };
    if (better(c, best, planning)) best = c;
    if (isHit(c)) break;
  }
  return best;
}

export function buildLevel(level: number): Level {
  const band = bandFor(level);
  const picked = snackForLevel(level);
  const snack = band.outline ? { id: picked.id, rows: outline(picked.rows, OUTLINE_KEY) } : picked;
  let best = search(level, snack.rows, band, '', null);
  if (best && !isHit(best) && (best.below || best.peakMiss === 1)) {
    best = search(level, snack.rows, escalate(band, MAX_LANES, SLOTS), 'x', best);
  }
  if (!best) throw new Error(`level ${String(level)}: no candidate`);
  const rules = { rows: snack.rows, lanes: best.gen.lanes, slots: SLOTS };
  const base = {
    snack: snack.id,
    rows: snack.rows,
    lanes: best.gen.lanes,
    slots: SLOTS,
    solution: best.gen.solution,
  };
  const problems = validateLevel(base);
  if (problems.length > 0) throw new Error(`level ${String(level)}: ${problems.join('; ')}`);
  const seed = hashSeed(`level:${String(level)}:metrics`);
  return {
    id: level,
    ...base,
    face: hashSeed(`face:${String(level)}`),
    metrics: measure(rules, best.gen.peakSlots, METRIC_PLAYOUTS, seed),
  };
}

export function buildLevels(count: number = LEVEL_COUNT): Level[] {
  const out: Level[] = [];
  for (let n = 1; n <= count; n++) out.push(buildLevel(n));
  return out;
}
