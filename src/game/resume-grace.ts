/**
 * Taps are ignored for this long after a platform resume. Bridge 2.3.1 pauses the game when
 * its window loses focus and resumes it on focus (src/platform/bridge.ts); in a host page the
 * focus only comes back with the next tap inside the game, and on iOS Safari that tap reaches
 * Phaser after the resume, so it counted as a game tap (sandbox report 2026-10-18: a heart on a
 * non-target right after an ad). The tap that woke the game is never a game tap.
 */
export const RESUME_TAP_GRACE_MS = 350;

/** The part of a Phaser scene the gate needs. */
interface InputHost {
  input: { enabled: boolean };
}

/**
 * One gate in front of every pointer handler of a scene (scene listeners, HUD buttons, the
 * in-game menu, the Title buttons): the scene's input is off while the platform pause holds and
 * for RESUME_TAP_GRACE_MS after it lifts. Wall clock on purpose: the scene clock is frozen under
 * the pause and crawls under slow frames.
 */
export class ResumeGrace {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly scene: InputHost) {}

  /** Scene (re)start: no pending grace, input on. */
  reset(): void {
    this.clear();
    this.scene.input.enabled = true;
  }

  pause(): void {
    this.clear();
    this.scene.input.enabled = false;
  }

  /** Input returns after the grace, unless a pause comes first. */
  resume(): void {
    this.clear();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.scene.input.enabled = true;
    }, RESUME_TAP_GRACE_MS);
  }

  /** Scene shutdown: a pending timer must not touch a scene that is gone. */
  dispose(): void {
    this.clear();
  }

  private clear(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}
