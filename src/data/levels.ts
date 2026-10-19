import type { Level } from '../gen/level';
import json from './levels.json';

/** The fixed level list (GDD §8), built by `npm run levels` (GENERATOR.md §6). */
export const LEVELS: readonly Level[] = json;

/**
 * Level n of the list; past the end the last level repeats (v0.1, docs/questions.md); anything
 * that is not a level number gives level 1.
 */
export function levelFor(n: number): Level {
  const k = Number.isFinite(n) ? Math.floor(n) : 1;
  const i = Math.min(Math.max(1, k), LEVELS.length) - 1;
  return LEVELS[i] as Level;
}
