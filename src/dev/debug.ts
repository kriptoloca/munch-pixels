/**
 * Dev-only hooks for the e2e tests (`window.__munchDebug`). Installed by the active scene inside
 * `if (import.meta.env.DEV)`, so production builds drop them (links.spec checks the absence).
 */
export interface DebugPoint {
  x: number;
  y: number;
}

export interface MunchDebugState {
  scene: string;
  level: number;
  platformId: string;
  messages: string[];
  paused: boolean;
}

export interface MunchDebug {
  state: () => MunchDebugState;
  /** Screen (CSS px) point of a named button of the current scene, or null. */
  point: (name: string) => DebugPoint | null;
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
