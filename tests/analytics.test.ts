import { beforeEach, describe, expect, it } from 'vitest';
import {
  TRACK_LOG_SIZE,
  attachAnalyticsSink,
  resetAnalytics,
  track,
  trackedCount,
  trackedEvents,
} from '../src/platform/analytics';

describe('analytics (local only, brief §8)', () => {
  beforeEach(() => {
    resetAnalytics();
  });

  it('counts events and keeps their props', () => {
    track('level_start', { level: 3 });
    track('booster_used', { kind: 'undo' });
    track('booster_used', { kind: 'slot' });
    expect(trackedCount('booster_used')).toBe(2);
    expect(trackedEvents()[0]).toEqual({ event: 'level_start', props: { level: 3 } });
  });

  it('forwards only the level events to the platform as lifecycle messages', () => {
    const sent: string[] = [];
    attachAnalyticsSink((m) => sent.push(m));
    track('session_start');
    track('level_start', { level: 1 });
    track('level_complete', { level: 1, seconds: 30 });
    track('level_fail', { level: 2, seconds: 12 });
    track('ad_interstitial_shown');
    expect(sent).toEqual(['level_started', 'level_completed', 'level_failed']);
  });

  it('keeps a bounded log', () => {
    for (let i = 0; i < TRACK_LOG_SIZE + 25; i++) track('level_start', { level: i });
    expect(trackedEvents()).toHaveLength(TRACK_LOG_SIZE);
    expect(trackedCount('level_start')).toBe(TRACK_LOG_SIZE + 25);
  });
});
