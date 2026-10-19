import type { PlatformMessageName } from './bridge';

/**
 * Analytics without a network (brief §8, CLAUDE.md rule 1): events are counted in memory for the
 * dev state, and the three level events are forwarded to the platform as lifecycle messages
 * (Playgama and YouTube read those). Nothing leaves the page by itself.
 */
export type AnalyticsEvent =
  | 'session_start'
  | 'level_start'
  | 'level_complete'
  | 'level_fail'
  | 'booster_used'
  | 'ad_rewarded_shown'
  | 'ad_interstitial_shown'
  | 'session_end';

export type AnalyticsProps = Record<string, string | number | boolean>;

export interface TrackRecord {
  event: AnalyticsEvent;
  props: AnalyticsProps;
}

/** The dev state keeps the last events only. */
export const TRACK_LOG_SIZE = 100;

const FORWARD: Partial<Record<AnalyticsEvent, PlatformMessageName>> = {
  level_start: 'level_started',
  level_complete: 'level_completed',
  level_fail: 'level_failed',
};

type Sink = (name: PlatformMessageName) => void;

const log: TrackRecord[] = [];
const counts = new Map<AnalyticsEvent, number>();
let sink: Sink | null = null;

/** Boot attaches the platform's sendMessage once it is initialised. */
export function attachAnalyticsSink(s: Sink | null): void {
  sink = s;
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  log.push({ event, props });
  if (log.length > TRACK_LOG_SIZE) log.shift();
  counts.set(event, (counts.get(event) ?? 0) + 1);
  const message = FORWARD[event];
  if (message && sink) sink(message);
}

export function trackedEvents(): readonly TrackRecord[] {
  return log;
}

export function trackedCount(event: AnalyticsEvent): number {
  return counts.get(event) ?? 0;
}

/** Tests only. */
export function resetAnalytics(): void {
  log.length = 0;
  counts.clear();
  sink = null;
}
