import { countByColour, openGround, parsePicture, reachable } from '../core/board';
import { Game, replay, type MuncherSpec } from '../core/game';
import { Rng } from './rng';

/** What the generator needs to know about a level's band (src/gen/params.ts). */
export interface GenParams {
  lanes: number;
  /** Chance that a planned muncher queues behind the previous one (dealLanes). */
  runChance: number;
  slots: number;
  appetiteMin: number;
  appetiteMax: number;
  waitBudget: number;
  pWait: number;
}

export interface Generated {
  lanes: MuncherSpec[][];
  /** Lane index per tap: the planned order, replays to a win. */
  solution: number[];
  /** Most slots the planned order occupies at once. */
  peakSlots: number;
}

/**
 * Peels the picture into a planned solution (GENERATOR.md §3): one muncher at a time, played on
 * the real rules while it is planned, so the plan is a solution by construction. Returns the
 * munchers in planned order, or null if the plan could not be finished (it always can; null is a
 * guard against a bug, and the caller then tries another seed).
 */
export function planMunchers(
  rows: readonly string[],
  p: GenParams,
  rng: Rng,
): MuncherSpec[] | null {
  const { board, keys } = parsePicture(rows);
  const unassigned = countByColour(board, keys.length);
  const game = new Game({ rows, lanes: [[]], slots: p.slots }, { history: false });
  const planned: MuncherSpec[] = [];
  const total = (): number => unassigned.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (total() > 0) {
    guard += 1;
    if (guard > 10_000) return null;
    const waiting = game.slots.filter((s) => s !== null).length;
    const open = openGround(game.board);
    const reach = keys.map((_, c) => reachable(game.board, c, open).length);
    const seatedColours = new Set(game.slots.flatMap((s) => (s ? [s.colour] : [])));
    const immediate = keys
      .map((_, c) => c)
      .filter((c) => (unassigned[c] as number) > 0 && (reach[c] as number) > 0);
    const waits =
      waiting < p.waitBudget && waiting < p.slots - 1
        ? keys
            .map((_, c) => c)
            .filter((c) => {
              const u = unassigned[c] as number;
              const lo = Math.max(p.appetiteMin, (reach[c] as number) + 1);
              return u > (reach[c] as number) && lo <= Math.min(p.appetiteMax, u);
            })
        : [];
    let colour: number;
    let appetite: number;
    if (waits.length > 0 && rng.chance(p.pWait)) {
      colour = rng.pick(waits);
      const u = unassigned[colour] as number;
      const lo = Math.max(p.appetiteMin, (reach[colour] as number) + 1);
      appetite = rng.int(lo, Math.min(p.appetiteMax, u));
    } else {
      // A seated muncher of a colour with reachable pixels would have eaten them, so `immediate`
      // never offers a colour that is already waiting; it is never empty (GENERATOR.md §2).
      if (immediate.length === 0) return null;
      colour = rng.pick(immediate);
      if (seatedColours.has(colour)) return null;
      appetite = immediateAppetite(
        unassigned[colour] as number,
        reach[colour] as number,
        p.appetiteMin,
        p.appetiteMax,
        rng,
      );
    }
    const m: MuncherSpec = { c: keys[colour] as string, a: appetite };
    unassigned[colour] = (unassigned[colour] as number) - appetite;
    planned.push(m);
    game.append(0, m);
    if (game.tap(0).result !== 'ok') return null;
  }
  return game.status === 'won' ? planned : null;
}

/**
 * An appetite a muncher can fill at once (≤ reach), from the band's range when it fits, avoiding
 * a leftover smaller than the minimum when the colour could be finished instead.
 */
function immediateAppetite(
  unassigned: number,
  reach: number,
  min: number,
  max: number,
  rng: Rng,
): number {
  const cap = Math.min(unassigned, reach);
  if (unassigned <= max && unassigned <= reach) return unassigned; // finish the colour
  if (cap <= min) return cap;
  let a = rng.int(min, Math.min(max, cap));
  const rest = unassigned - a;
  if (rest > 0 && rest < min) {
    // Leave at least `min` for the next muncher of this colour, or take everything if possible.
    if (unassigned <= cap) a = unassigned;
    else if (unassigned - min >= 1) a = Math.min(a, unassigned - min);
  }
  return Math.max(1, a);
}

/**
 * Deals the planned order into lanes (GENERATOR.md §3): each muncher goes to a random lane among
 * the shortest ones (± 1), or queues behind the previous one (a run), keeping the planned order
 * inside every lane, so tapping the lanes in planned order is always legal. When only as many
 * munchers are left as lanes are empty, they go to the empty lanes, so no lane stays empty.
 */
export function dealLanes(
  planned: readonly MuncherSpec[],
  laneCount: number,
  rng: Rng,
  runChance = 0,
): { lanes: MuncherSpec[][]; solution: number[] } {
  const lanes: MuncherSpec[][] = Array.from({ length: laneCount }, () => []);
  const solution: number[] = [];
  const cap = Math.ceil(planned.length / laneCount) + 1;
  let previous = -1;
  for (const [i, m] of planned.entries()) {
    let lane: number;
    const empty = lanes.flatMap((l, j) => (l.length === 0 ? [j] : []));
    if (empty.length > 0 && planned.length - i <= empty.length) {
      // Only as many munchers left as empty lanes: each empty lane gets one (no lane stays empty).
      lane = rng.pick(empty);
    } else if (
      previous !== -1 &&
      (lanes[previous] as MuncherSpec[]).length < cap &&
      rng.chance(runChance)
    ) {
      // A run: the next planned muncher queues behind the previous one, so the other lanes'
      // fronts belong to later moves (the traps a hasty player can fall into).
      lane = previous;
    } else {
      const shortest = Math.min(...lanes.map((l) => l.length));
      const open = lanes.flatMap((l, i) => (l.length <= shortest + 1 ? [i] : []));
      lane = rng.pick(open);
    }
    (lanes[lane] as MuncherSpec[]).push(m);
    solution.push(lane);
    previous = lane;
  }
  return { lanes, solution };
}

/** Plans and deals one candidate level; null when the seed could not make a valid one. */
export function generate(rows: readonly string[], p: GenParams, seed: number): Generated | null {
  const rng = new Rng(seed);
  const planned = planMunchers(rows, p, rng);
  if (!planned || planned.length < p.lanes) return null;
  const { lanes, solution } = dealLanes(planned, p.lanes, rng, p.runChance);
  if (lanes.some((l) => l.length === 0)) return null;
  const r = replay({ rows, lanes, slots: p.slots }, solution);
  if (!r.legal || r.status !== 'won') return null;
  return { lanes, solution, peakSlots: r.peakSlots };
}
