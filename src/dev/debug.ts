import type { AudioDebug } from '../game/audio';
import type { FeelEvent } from '../game/feel';
import type { PoolCounts } from '../game/fx';

/**
 * Dev-only hooks for the e2e tests (`window.__munchDebug`). Installed by the active scene inside
 * `if (import.meta.env.DEV)`, so production builds drop them (smoke.spec checks the absence).
 */
export interface DebugPoint {
  x: number;
  y: number;
}

/** The screen as drawn: per slot the rules' seated muncher's view, frames, dens. */
export interface ScreenShot {
  seats: ({ digit: number; alpha: number; x: number; y: number; face: string } | null)[];
  amber: boolean[];
  dens: { front: number; digits: number[]; alphas: number[]; more: string }[];
}

/** The Game scene's part of the dev state (Epics 3–4). */
export interface GameDebugState {
  status: 'playing' | 'won' | 'lost';
  /** The panel on screen, once the rules' verdict has played out. */
  panel: 'win' | 'lose' | null;
  taps: number;
  /** Timeline actions still to play (0 = the screen shows the rules' state). */
  pending: number;
  /** The stored solution of the level (lane per tap). */
  solution: number[];
  lanes: number;
  fronts: number[];
  /** Taps on a muncher behind the front (the nope). */
  nopes: number;
  /** Muncher views out of the dens (seated or leaving) and still in the dens. */
  outViews: number;
  denViews: number;
  /** Den munchers not fully visible (0 once every tween has settled). */
  faded: number;
  /** Where the screen disagrees with the rules (empty once the timeline has settled). */
  mismatches: string[];
  /** Sum over every object's position, alpha and scale (unchanged while nothing moves). */
  motion: number;
  /** Den taps count now; the open panel takes presses now; the scene time it opened. */
  inputOpen: boolean;
  panelReady: boolean;
  panelAt: number;
  savedLevel: number;
  levelsCompleted: number;
  /** Palette key of each lane's front muncher (null when the lane is empty). */
  frontKeys: (string | null)[];
  /** Slot centres (design px) and the screen as drawn. */
  slots: DebugPoint[];
  screen: ScreenShot;
  /** Epic 4 feel log, newest last, kept across levels (`level` tells them apart). */
  feel: FeelEvent[];
  /** Tween time scale: 0 inside a hit stop, 1 / feelslow otherwise. */
  timeScale: number;
  /** Hit stops started, camera shakes started (the camera's own SHAKE_START event). */
  hitStops: number;
  shakeStarts: number;
  shaking: boolean;
  /** Scene clock (ms). */
  clock: number;
  /** Pooled effects (flights, crumbs, puffs, confetti). */
  pool: PoolCounts;
  /** Display objects in the scene, muncher views alive, the open panel's own objects. */
  objects: number;
  views: number;
  panelObjects: number;
  /**
   * The win face: blinks played, redrawn with its grin; the board's scale now and the scale the
   * win grows it to (WIN_FACE_SCALE, capped where the board would reach a neighbour).
   */
  blinks: number;
  smile: boolean;
  boardScale: number;
  winScale: number;
}

export interface MunchDebugState {
  scene: string;
  level: number;
  platformId: string;
  messages: string[];
  paused: boolean;
  /** The audio manager (Boot binds it before the Title). */
  audio?: AudioDebug;
  game?: GameDebugState;
}

export interface MunchDebug {
  state: () => MunchDebugState;
  /** Screen (CSS px) point of a named button of the current scene, or null. */
  point: (name: string) => DebugPoint | null;
  /** Game scene: a tap order that loses the current level (null when none was found). */
  losingTaps?: () => number[] | null;
  /** Game scene: moves the saved progress under a level in play (a late save read, e2e). */
  setSavedLevel?: (level: number) => void;
  /** Plays a platform pause (true) or resume (false), as the host would (bridge.ts). */
  pause?: (paused: boolean) => void;
  /** Game scene: starts a hit stop of `ms` (× feelslow), as a full meal does (e2e). */
  hitStop?: (ms: number) => void;
}

declare global {
  interface Window {
    __munchDebug?: MunchDebug;
  }
}

export function installDebug(hooks: MunchDebug): void {
  window.__munchDebug = hooks;
}

export function uninstallDebug(): void {
  delete window.__munchDebug;
}

/** Converts a design-space point of the game canvas to a CSS-pixel point on the page. */
export function toScreen(
  canvas: HTMLCanvasElement,
  gameWidth: number,
  x: number,
  y: number,
): DebugPoint {
  const r = canvas.getBoundingClientRect();
  const k = r.width / gameWidth;
  return { x: r.left + x * k, y: r.top + y * k };
}
