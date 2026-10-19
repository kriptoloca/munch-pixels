import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESUME_TAP_GRACE_MS, ResumeGrace } from '../src/game/resume-grace';

/** The input gate behind the platform pause (docs/questions.md 2026-10-18, host focus). */
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
});
