/**
 * Dev-only hooks for the e2e tests (`window.__munchDebug`). Installed by the active scene inside
 * `if (import.meta.env.DEV)`, so production builds drop them (smoke.spec checks the absence).
 */
export interface DebugPoint {
  x: number;
  y: number;
}

/** The Game scene's part of the dev state (Epic 3). */
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
  /** Den taps count now; the open panel takes presses now. */
  inputOpen: boolean;
  panelReady: boolean;
  savedLevel: number;
  levelsCompleted: number;
}

export interface MunchDebugState {
  scene: string;
  level: number;
  platformId: string;
  messages: string[];
  paused: boolean;
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
