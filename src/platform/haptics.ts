/**
 * Haptic feedback through the Vibration API. Android Chrome and the Android WebView support it
 * (after a user gesture, which every call here follows); iOS WebKit has no Vibration API, so
 * iPhones silently get nothing, like desktops. Patterns are short so they never feel like an
 * alarm, and the game stays identical without them (no feature depends on haptics).
 */
export type HapticKind = 'hop' | 'full' | 'nope' | 'won' | 'stuck' | 'booster';

/**
 * Milliseconds on/off, per Vibration API (GDD §3a). Keep every pattern ≤ 200 ms in total.
 * Failure never outweighs success: the no-slot tap is the shortest, a stuck level lighter than a
 * won one, and a full meal stronger than a hop.
 */
export const HAPTIC_PATTERNS: Record<HapticKind, number[]> = {
  hop: [10],
  full: [12],
  nope: [8],
  won: [20, 40, 40],
  stuck: [30],
  booster: [10],
};

type Vibrator = { vibrate?: (pattern: number | number[]) => boolean };

let enabled = true;

/** Platform pause / dev switch: haptics off while paused. */
export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

export function hapticsSupported(nav: Vibrator | undefined = globalThis.navigator): boolean {
  return nav !== undefined && typeof nav.vibrate === 'function';
}

/** Fires the pattern; returns whether the device accepted it. Never throws. */
export function haptic(
  kind: HapticKind,
  nav: Vibrator | undefined = globalThis.navigator,
): boolean {
  if (!enabled || !hapticsSupported(nav) || !nav?.vibrate) return false;
  try {
    return nav.vibrate(HAPTIC_PATTERNS[kind]) === true;
  } catch {
    return false;
  }
}
