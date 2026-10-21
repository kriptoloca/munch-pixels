import type { Game } from '../core/game';
import { audio } from '../game/audio';
import type { Level } from '../gen/level';
import { findLosingTaps } from '../gen/metrics';
import { denPoint, type GameLayout, type Point } from '../game/layout';
import { progress } from '../game/state';
import { getPlatform, sentPlatformMessages, simulatePause } from '../platform/bridge';
import type { FeelEvent } from '../game/feel';
import type { PoolCounts } from '../game/fx';
import { installDebug, toScreen, type ScreenShot } from './debug';

/** Seeds tried by the hook that looks for a losing tap order. */
const LOSING_TRIES = 400;

/** What the Game scene shows the dev hooks (built inside its DEV branch only). */
export interface GameProbe {
  level: () => Level;
  rules: () => Game;
  layout: () => GameLayout;
  canvas: () => HTMLCanvasElement;
  pending: () => number;
  panel: () => 'win' | 'lose' | null;
  panelButton: () => Point | null;
  nopes: () => number;
  outViews: () => number;
  denViews: () => number;
  /** Munchers drawn in a den (front and queue). */
  shown: (lane: number) => number;
  /** Den munchers that are not fully visible (hidden or faded). */
  faded: () => number;
  /** A sum over every object's position, alpha and scale: unchanged while nothing moves. */
  motion: () => number;
  /** Taps on the dens count now (level-start guard over, no pause, no panel). */
  inputOpen: () => boolean;
  /** The open panel takes presses now (its guard is over); when it opened. */
  panelReady: () => boolean;
  panelAt: () => number;
  /** What the screen shows, to compare with the rules. */
  screen: () => ScreenShot;
  feel: () => FeelEvent[];
  timeScale: () => number;
  hitStops: () => number;
  shakeStarts: () => number;
  shaking: () => boolean;
  clock: () => number;
  pool: () => PoolCounts;
  objects: () => number;
  views: () => number;
  panelObjects: () => number;
  blinks: () => number;
  smile: () => boolean;
  boardScale: () => number;
  winScale: () => number;
  hitStop: (ms: number) => void;
}

/**
 * Differences between the screen and the rules once the timeline has settled (empty = the
 * screen tells the truth). Read by the e2e after taps, resizes and pauses (audit 2026-10-19).
 */
export function screenMismatches(rules: Game, L: GameLayout, shot: ScreenShot): string[] {
  const out: string[] = [];
  rules.slots.forEach((s, i) => {
    const v = shot.seats[i];
    const at = L.slots[i];
    if (!s) return;
    if (!v) {
      out.push(`slot ${String(i)}: no view for the seated muncher`);
      return;
    }
    if (v.alpha < 0.99) out.push(`slot ${String(i)}: alpha ${v.alpha.toFixed(2)}`);
    if (v.digit !== s.remaining) {
      out.push(`slot ${String(i)}: digit ${String(v.digit)} ≠ ${String(s.remaining)}`);
    }
    if (at && Math.hypot(v.x - at.x, v.y - at.y) > 1) out.push(`slot ${String(i)}: not in place`);
    // a muncher still seated after the timeline settled is waiting: mouth open, eyes up; on a
    // lost level it looks down (GDD §3a)
    const face = rules.status === 'lost' ? 'stuck' : 'waiting';
    if (s.waiting && v.face !== face) out.push(`slot ${String(i)}: face ${v.face} ≠ ${face}`);
  });
  shot.amber.forEach((a, i) => {
    if (a !== (rules.slots[i]?.waiting === true)) out.push(`slot ${String(i)}: amber ${String(a)}`);
  });
  shot.dens.forEach((d, lane) => {
    const queue = rules.lanes[lane] ?? [];
    const front = rules.fronts[lane] ?? 0;
    if (d.front !== front)
      out.push(`den ${String(lane)}: front ${String(d.front)} ≠ ${String(front)}`);
    d.digits.forEach((digit, k) => {
      const m = queue[front + k];
      if (!m || m.appetite !== digit)
        out.push(`den ${String(lane)}.${String(k)}: digit ${String(digit)}`);
    });
    if (d.alphas.some((a) => a < 0.99)) out.push(`den ${String(lane)}: a faded muncher`);
    const hidden = queue.length - front - d.digits.length;
    const more = hidden > 0 ? `+${String(hidden)}` : '';
    if (d.more !== more) out.push(`den ${String(lane)}: chip "${d.more}" ≠ "${more}"`);
  });
  return out;
}

/**
 * The Game scene's `__munchDebug` (Epic 3 e2e). Loaded with a dynamic import from the scene's
 * DEV branch, so production builds carry none of it (smoke.spec checks the absence).
 */
export function installGameDebug(p: GameProbe): void {
  const platform = getPlatform();
  const screen = (at: Point | null): { x: number; y: number } | null =>
    at ? toScreen(p.canvas(), p.layout().width, at.x, at.y) : null;
  installDebug({
    state: () => {
      const rules = p.rules();
      return {
        scene: 'Game',
        level: p.level().id,
        platformId: platform.platformId,
        messages: [...sentPlatformMessages()],
        paused: platform.isPaused(),
        audio: audio.debug(),
        game: {
          status: rules.status,
          panel: p.panel(),
          taps: rules.taps,
          pending: p.pending(),
          solution: [...p.level().solution],
          lanes: rules.lanes.length,
          fronts: [...rules.fronts],
          nopes: p.nopes(),
          outViews: p.outViews(),
          denViews: p.denViews(),
          faded: p.faded(),
          motion: p.motion(),
          inputOpen: p.inputOpen(),
          panelReady: p.panelReady(),
          panelAt: p.panelAt(),
          mismatches: screenMismatches(rules, p.layout(), p.screen()),
          savedLevel: progress.level,
          levelsCompleted: progress.levelsCompleted,
          frontKeys: rules.lanes.map((_, lane) => {
            const m = rules.front(lane);
            return m ? (rules.keys[m.colour] ?? null) : null;
          }),
          slots: p.layout().slots.map((q) => ({ x: q.x, y: q.y })),
          screen: p.screen(),
          feel: [...p.feel()],
          timeScale: p.timeScale(),
          hitStops: p.hitStops(),
          shakeStarts: p.shakeStarts(),
          shaking: p.shaking(),
          clock: p.clock(),
          pool: p.pool(),
          objects: p.objects(),
          views: p.views(),
          panelObjects: p.panelObjects(),
          blinks: p.blinks(),
          smile: p.smile(),
          boardScale: p.boardScale(),
          winScale: p.winScale(),
        },
      };
    },
    point: (name) => {
      const [what, arg] = name.split(':');
      const lane = Number(arg);
      const L = p.layout();
      if (what === 'lane' && L.lanes[lane]) return screen(denPoint(L, lane, 0));
      if (what === 'behind' && L.lanes[lane] && p.shown(lane) > 1) {
        return screen(denPoint(L, lane, 1));
      }
      const panel = p.panel();
      if ((what === 'next' && panel === 'win') || (what === 'retry' && panel === 'lose')) {
        return screen(p.panelButton());
      }
      return null;
    },
    losingTaps: () => findLosingTaps(p.level(), LOSING_TRIES, p.level().id),
    setSavedLevel: (n) => {
      progress.level = n;
    },
    pause: simulatePause,
    hitStop: p.hitStop,
  });
}
