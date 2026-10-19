/**
 * Interstitial gating (CLAUDE.md rule 6, GDD §6): an interstitial may be requested only when
 * BOTH hold — at least SCENES_PER_INTERSTITIAL scenes were completed since the last one (or
 * since session start) AND at least MIN_INTERVAL_MS elapsed since the last one (or since session
 * start). Pure and testable; the Bridge's own minimum delay is a second guard, not the source of
 * truth.
 */
export const SCENES_PER_INTERSTITIAL = 3;
export const MIN_INTERVAL_MS = 120_000;

export class AdGate {
  private completedSinceLast = 0;
  private lastShownAt: number;

  /** `now` is a monotonic ms clock (performance.now or Phaser's time.now). */
  constructor(now: number) {
    this.lastShownAt = now;
  }

  onSceneCompleted(): void {
    this.completedSinceLast += 1;
  }

  scenesSinceLast(): number {
    return this.completedSinceLast;
  }

  shouldShowInterstitial(now: number): boolean {
    return (
      this.completedSinceLast >= SCENES_PER_INTERSTITIAL &&
      now - this.lastShownAt >= MIN_INTERVAL_MS
    );
  }

  /** Call when an interstitial was actually requested (shown or failed: the attempt counts). */
  markShown(now: number): void {
    this.completedSinceLast = 0;
    this.lastShownAt = now;
  }
}
