/**
 * Level bands (GENERATOR.md §6): which snack a level uses and how its munchers are dealt. Values
 * are starting points; the measured difficulty (src/gen/metrics.ts) decides which candidate wins.
 */
export interface BandParams {
  /** First level of the band. */
  from: number;
  lanes: readonly number[];
  appetiteMin: number;
  appetiteMax: number;
  /** Most munchers the planned solution leaves waiting at once (≤ slots − 1). */
  waitBudget: number;
  /** Chance per planned muncher to be a planned wait. */
  pWait: number;
  /** Chance that a planned muncher queues behind the previous one (src/gen/generate.ts). */
  runChance: number;
  /** Wrap the snack in a one-pixel outline (OUTLINE_KEY) that buries every inner colour. */
  outline: boolean;
  /** Target difficulty range (1 − random-player win rate). */
  target: readonly [number, number];
}

/** Palette key of the outline (src/data/palette.ts). */
export const OUTLINE_KEY = 'd';

export const BANDS: readonly BandParams[] = [
  {
    from: 1,
    lanes: [2],
    appetiteMin: 4,
    appetiteMax: 10,
    waitBudget: 0,
    pWait: 0,
    runChance: 0,
    outline: false,
    target: [0, 0.1],
  },
  {
    from: 4,
    lanes: [2, 3],
    appetiteMin: 4,
    appetiteMax: 9,
    waitBudget: 1,
    pWait: 0.15,
    runChance: 0.2,
    outline: true,
    target: [0.05, 0.25],
  },
  {
    from: 11,
    lanes: [3],
    appetiteMin: 3,
    appetiteMax: 8,
    waitBudget: 2,
    pWait: 0.25,
    runChance: 0.4,
    outline: true,
    target: [0.2, 0.45],
  },
  {
    from: 31,
    lanes: [3, 4],
    appetiteMin: 3,
    appetiteMax: 8,
    waitBudget: 3,
    pWait: 0.3,
    runChance: 0.5,
    outline: true,
    target: [0.35, 0.6],
  },
  {
    from: 61,
    lanes: [4, 5],
    appetiteMin: 2,
    appetiteMax: 6,
    waitBudget: 4,
    pWait: 0.35,
    runChance: 0.6,
    outline: true,
    target: [0.45, 0.75],
  },
];

/** Levels in the list (GDD §8). */
export const LEVEL_COUNT = 100;
/** Seeds tried per level before the closest candidate is taken. */
export const CANDIDATES_PER_LEVEL = 24;
/** Random playouts per candidate while searching (a quick estimate, standard error ≈ 0.045). */
export const PLAYOUTS = 120;
/** Random playouts for the stored metrics of the chosen level (standard error ≈ 0.016). */
export const METRIC_PLAYOUTS = 1000;
/** Every Nth level is a breather, every Mth a peak (GENERATOR.md §6 sawtooth). */
export const BREATHER_EVERY = 5;
export const PEAK_EVERY = 10;
export const BREATHER_DROP = 0.15;
export const PEAK_RISE = 0.1;
export const TARGET_MAX = 0.9;
/** Levels 1 to this one meet the snacks in list order. */
export const SNACKS_IN_ORDER = 30;
/** Later levels cycle through the snacks from this index (the ones before it only teach). */
export const SNACK_CYCLE_FROM = 9;
/**
 * After that, the light snacks (few colours or few pixels: they stay easy however they are dealt,
 * docs/questions.md) only come on breather levels; every other level cycles through the rest.
 * Both cycles mirror the picture on every other pass.
 */
export const LIGHT_SNACKS: readonly string[] = [
  'apple',
  'cheese',
  'strawberry',
  'cookie',
  'grapes',
  'pear',
  'popsicle',
];
/**
 * Second round for a level whose best candidate stayed below its target (snacks with few colours
 * come out easy): CANDIDATES_PER_LEVEL more seeds with harder dealing, each value raised by these
 * steps and capped (docs/questions.md, Epic 2 tuning).
 */
export const ESCALATE_LANES = 1;
export const ESCALATE_WAIT = 1;
export const ESCALATE_P_WAIT = 0.15;
export const ESCALATE_RUN = 0.2;
export const ESCALATE_P_WAIT_MAX = 0.6;
export const ESCALATE_RUN_MAX = 0.8;
/**
 * From this level on, every peak (PEAK_EVERY) is a planning level: it prefers a candidate the
 * greedy player loses, so a few levels ask for thought ahead (Flow pillar: tension saved for a
 * few moves; GDD §6).
 */
export const PLANNING_PEAK_FROM = 20;

export function bandFor(level: number): BandParams {
  let band = BANDS[0] as BandParams;
  for (const b of BANDS) if (level >= b.from) band = b;
  return band;
}

/** A breather level (every BREATHER_EVERY, not a peak). */
export function isBreather(level: number): boolean {
  return level % BREATHER_EVERY === 0 && level % PEAK_EVERY !== 0;
}

/** Target difficulty for a level: the band's range, shifted by the sawtooth, as [lo, hi]. */
export function targetFor(level: number): [number, number] {
  const [lo, hi] = bandFor(level).target;
  let shift = 0;
  if (level % PEAK_EVERY === 0) shift = PEAK_RISE;
  else if (level % BREATHER_EVERY === 0) shift = -BREATHER_DROP;
  const clamp = (v: number): number => Math.min(TARGET_MAX, Math.max(0, v));
  return [clamp(lo + shift), clamp(hi + shift)];
}

/** A peak that asks for planning: the greedy player should lose it (PLANNING_PEAK_FROM). */
export function isPlanningPeak(level: number): boolean {
  return level >= PLANNING_PEAK_FROM && level % PEAK_EVERY === 0;
}

/** The harder dealing of the second round (ESCALATE_*), within the level format's limits. */
export function escalate(b: BandParams, maxLanes: number, slots: number): BandParams {
  return {
    ...b,
    lanes: b.lanes.map((n) => Math.min(maxLanes, n + ESCALATE_LANES)),
    waitBudget: Math.min(slots - 1, b.waitBudget + ESCALATE_WAIT),
    pWait: Math.min(ESCALATE_P_WAIT_MAX, b.pWait + ESCALATE_P_WAIT),
    runChance: Math.min(ESCALATE_RUN_MAX, b.runChance + ESCALATE_RUN),
  };
}
