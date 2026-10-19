import { describe, expect, it } from 'vitest';
import { AdGate, MIN_INTERVAL_MS, SCENES_PER_INTERSTITIAL } from '../src/platform/ads';

describe('AdGate', () => {
  it('never fires before three completed scenes, even after a long time', () => {
    const g = new AdGate(0);
    expect(g.shouldShowInterstitial(10 * MIN_INTERVAL_MS)).toBe(false);
    g.onSceneCompleted();
    g.onSceneCompleted();
    expect(g.shouldShowInterstitial(10 * MIN_INTERVAL_MS)).toBe(false);
  });

  it('never fires before 120 s, even after many scenes', () => {
    const g = new AdGate(0);
    for (let i = 0; i < 20; i++) g.onSceneCompleted();
    expect(g.shouldShowInterstitial(MIN_INTERVAL_MS - 1)).toBe(false);
    expect(g.shouldShowInterstitial(MIN_INTERVAL_MS)).toBe(true);
  });

  it('fires when both conditions hold and resets both counters on markShown', () => {
    const g = new AdGate(1_000);
    for (let i = 0; i < SCENES_PER_INTERSTITIAL; i++) g.onSceneCompleted();
    expect(g.shouldShowInterstitial(1_000 + MIN_INTERVAL_MS)).toBe(true);
    g.markShown(1_000 + MIN_INTERVAL_MS);
    expect(g.scenesSinceLast()).toBe(0);
    expect(g.shouldShowInterstitial(1_000 + 2 * MIN_INTERVAL_MS)).toBe(false);
    for (let i = 0; i < SCENES_PER_INTERSTITIAL; i++) g.onSceneCompleted();
    expect(g.shouldShowInterstitial(1_000 + MIN_INTERVAL_MS + MIN_INTERVAL_MS - 1)).toBe(false);
    expect(g.shouldShowInterstitial(1_000 + 2 * MIN_INTERVAL_MS)).toBe(true);
  });

  it('short levels (10 s each) cannot produce an ad every 30 s', () => {
    const g = new AdGate(0);
    let shown = 0;
    for (let t = 10_000, scenes = 0; t <= 600_000; t += 10_000) {
      g.onSceneCompleted();
      scenes += 1;
      if (g.shouldShowInterstitial(t)) {
        shown += 1;
        g.markShown(t);
      }
      expect(scenes).toBeGreaterThan(0);
    }
    // 10 minutes of 10-second scenes → at most one ad per 120 s
    expect(shown).toBeLessThanOrEqual(5);
    expect(shown).toBeGreaterThanOrEqual(4);
  });
});
