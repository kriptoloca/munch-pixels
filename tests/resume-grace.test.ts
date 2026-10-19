import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESUME_TAP_GRACE_MS, ResumeGrace, bindPauseGrace } from '../src/game/resume-grace';

/** The input gate behind the platform pause (CLAUDE.md rule 4; ported from Peek & Find). */
describe('ResumeGrace', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const make = (): { scene: { input: { enabled: boolean } }; g: ResumeGrace } => {
    const scene = { input: { enabled: true } };
    return { scene, g: new ResumeGrace(scene) };
  };

  it('keeps input off through the pause and for the grace after it', () => {
    const { scene, g } = make();
    g.pause();
    expect(scene.input.enabled).toBe(false);
    g.resume();
    expect(scene.input.enabled).toBe(false);
    vi.advanceTimersByTime(RESUME_TAP_GRACE_MS - 1);
    expect(scene.input.enabled).toBe(false);
    vi.advanceTimersByTime(1);
    expect(scene.input.enabled).toBe(true);
  });

  it('a pause inside the grace cancels the pending enable', () => {
    const { scene, g } = make();
    g.pause();
    g.resume();
    vi.advanceTimersByTime(100);
    g.pause();
    vi.advanceTimersByTime(RESUME_TAP_GRACE_MS * 2);
    expect(scene.input.enabled).toBe(false);
    g.resume();
    vi.advanceTimersByTime(RESUME_TAP_GRACE_MS);
    expect(scene.input.enabled).toBe(true);
  });

  it('reset turns input on at once; dispose drops a pending timer', () => {
    const { scene, g } = make();
    g.pause();
    g.resume();
    g.reset();
    expect(scene.input.enabled).toBe(true);
    g.pause();
    g.resume();
    g.dispose();
    vi.advanceTimersByTime(RESUME_TAP_GRACE_MS * 2);
    expect(scene.input.enabled).toBe(false);
  });

  it('a resume without a pause first still keeps input off for the grace', () => {
    const { scene, g } = make();
    g.resume();
    expect(scene.input.enabled).toBe(false);
    vi.advanceTimersByTime(RESUME_TAP_GRACE_MS);
    expect(scene.input.enabled).toBe(true);
  });

  it('bindPauseGrace: a pause that began before the scene subscribed keeps input off', () => {
    const { scene, g } = make();
    let listener: (paused: boolean) => void = () => undefined;
    let subscribed = true;
    const platform = {
      isPaused: () => true,
      onPause: (cb: (paused: boolean) => void) => {
        listener = cb;
        return () => {
          subscribed = false;
        };
      },
    };
    const unsubscribe = bindPauseGrace(g, platform);
    expect(scene.input.enabled).toBe(false);
    vi.advanceTimersByTime(RESUME_TAP_GRACE_MS * 3);
    expect(scene.input.enabled).toBe(false);
    listener(false);
    vi.advanceTimersByTime(RESUME_TAP_GRACE_MS);
    expect(scene.input.enabled).toBe(true);
    unsubscribe();
    expect(subscribed).toBe(false);
  });

  it('bindPauseGrace: an unpaused platform leaves input on, later pauses still gate it', () => {
    const { scene, g } = make();
    scene.input.enabled = false;
    let listener: (paused: boolean) => void = () => undefined;
    bindPauseGrace(g, {
      isPaused: () => false,
      onPause: (cb) => {
        listener = cb;
        return () => undefined;
      },
    });
    expect(scene.input.enabled).toBe(true);
    listener(true);
    expect(scene.input.enabled).toBe(false);
  });
});
