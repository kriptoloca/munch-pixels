import { describe, expect, it } from 'vitest';
import {
  HAPTIC_PATTERNS,
  haptic,
  hapticsSupported,
  setHapticsEnabled,
} from '../src/platform/haptics';

const on = (p: number[]): number => p.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);

describe('haptics', () => {
  it('patterns are short taps, never alarms', () => {
    for (const [kind, p] of Object.entries(HAPTIC_PATTERNS)) {
      const total = p.reduce((a, b) => a + b, 0);
      expect(total, kind).toBeLessThanOrEqual(200);
      expect(
        p.every((ms) => ms > 0 && ms <= 100),
        kind,
      ).toBe(true);
    }
  });

  it('failure never outweighs success (GDD §3a)', () => {
    expect(on(HAPTIC_PATTERNS.nope)).toBeLessThan(on(HAPTIC_PATTERNS.hop));
    expect(on(HAPTIC_PATTERNS.nope)).toBeLessThan(on(HAPTIC_PATTERNS.full));
    expect(on(HAPTIC_PATTERNS.stuck)).toBeLessThan(on(HAPTIC_PATTERNS.won));
    expect(on(HAPTIC_PATTERNS.full)).toBeGreaterThan(on(HAPTIC_PATTERNS.hop));
  });

  it('detects support and fires the pattern of the kind', () => {
    const calls: (number | number[])[] = [];
    const nav = { vibrate: (p: number | number[]): boolean => (calls.push(p), true) };
    expect(hapticsSupported(nav)).toBe(true);
    expect(haptic('full', nav)).toBe(true);
    expect(haptic('nope', nav)).toBe(true);
    expect(calls).toEqual([HAPTIC_PATTERNS.full, HAPTIC_PATTERNS.nope]);
  });

  it('is a silent no-op without the API (iOS, desktop) and when the device refuses', () => {
    expect(hapticsSupported({})).toBe(false);
    expect(hapticsSupported(undefined)).toBe(false);
    expect(haptic('won', {})).toBe(false);
    expect(haptic('won', undefined)).toBe(false);
    expect(
      haptic('stuck', {
        vibrate: () => {
          throw new Error('denied');
        },
      }),
    ).toBe(false);
    expect(haptic('stuck', { vibrate: () => false })).toBe(false);
  });

  it('can be switched off (platform pause) and on again', () => {
    const nav = { vibrate: (): boolean => true };
    setHapticsEnabled(false);
    expect(haptic('full', nav)).toBe(false);
    setHapticsEnabled(true);
    expect(haptic('full', nav)).toBe(true);
  });
});
