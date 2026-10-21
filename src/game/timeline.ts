import type { GameEvent } from '../core/game';
import {
  BITE_FLIGHT_MS,
  BITE_INTERVAL_MS,
  CRUMB_MS,
  FAST_FORWARD_MS,
  FULL_BOUNCE_MS,
  FULL_HIT_STOP_MS,
  HOP_MS,
  HOP_SQUASH_MS,
  LEAVE_MS,
  STUCK_MS,
  STUCK_STAGGER_MS,
  WAKE_MS,
  WIN_BEAT_MS,
} from './feel';

/**
 * What the timeline plays: the rules' events, plus the stuck beat of a lost level (GDD §3a):
 * `stuck` turns one seated muncher's face down, slot by slot (`k` = 0, 1, …), STUCK_STAGGER_MS
 * apart from the moment the last muncher sat down; the `lost` panel comes STUCK_MS after it.
 */
export type PlayEvent = GameEvent | { kind: 'stuck'; slot: number; k: number };

/**
 * A play event with the time the scene shows it; `fast` when a later tap squeezed it; `who`
 * names the muncher a slot event belongs to (`lane:index`): a slot can take a new muncher in the
 * rules while its previous one is still leaving on screen, so the scene tracks munchers.
 */
export type Action = PlayEvent & { at: number; fast: boolean; who: string };

/** The id the scene keys a muncher's view by. */
export function muncherId(lane: number, index: number): string {
  return `${String(lane)}:${String(index)}`;
}

/**
 * Plays the rules back at the speed of the Feel spec (GDD §3a). The rules resolve a tap at once
 * and report its events in order; the timeline gives each event a time:
 * - a tap's events play in their own order (a hop, the bites 70 ms apart once it landed, a chain
 *   wake after the bites that caused it), so a pixel never leaves before the one that opened it;
 * - a new tap first squeezes everything still pending from earlier taps into FAST_FORWARD_MS, so
 *   input stays open and the new muncher never waits on an old animation.
 * Pure (no Phaser, no clock): the scene passes its own time and drains due actions per frame.
 */
export class Timeline {
  private readonly queue: Action[] = [];
  /** Who sits in each slot, in the rules' order of events (kept across taps). */
  private readonly occupant = new Map<number, string>();

  /** Starts over from the rules' seats (level start, undo, redraw). */
  reset(seats: readonly (string | null)[]): void {
    this.queue.length = 0;
    this.occupant.clear();
    seats.forEach((who, slot) => {
      if (who !== null) this.occupant.set(slot, who);
    });
  }

  /** Schedules one tap's events from `now`. */
  add(events: readonly GameEvent[], now: number): void {
    this.fastForward(now);
    let cursor = now;
    let end = now;
    const landed = new Map<number, number>();
    const seat = (slot: number): string => this.occupant.get(slot) ?? '';
    for (const e of events) {
      switch (e.kind) {
        case 'hop': {
          const who = muncherId(e.lane, e.index);
          this.occupant.set(e.slot, who);
          this.insert({ ...e, at: cursor, fast: false, who });
          cursor += HOP_MS;
          end = Math.max(end, cursor);
          break;
        }
        case 'wake':
          this.insert({ ...e, at: cursor, fast: false, who: seat(e.slot) });
          cursor += WAKE_MS;
          break;
        case 'bite': {
          this.insert({ ...e, at: cursor, fast: false, who: seat(e.slot) });
          const land = cursor + BITE_FLIGHT_MS;
          landed.set(e.slot, land);
          end = Math.max(end, land);
          cursor += BITE_INTERVAL_MS;
          break;
        }
        case 'full':
        case 'wait': {
          const at = landed.get(e.slot) ?? cursor;
          this.insert({ ...e, at, fast: false, who: seat(e.slot) });
          if (e.kind === 'full') this.occupant.delete(e.slot);
          end = Math.max(end, at);
          break;
        }
        case 'won':
          this.insert({ ...e, at: Math.max(end, cursor) + WIN_BEAT_MS, fast: false, who: '' });
          break;
        case 'lost': {
          const beat = Math.max(end, cursor);
          const seats = [...this.occupant.keys()].sort((a, b) => a - b);
          seats.forEach((slot, k) => {
            const at = beat + k * STUCK_STAGGER_MS;
            this.insert({ kind: 'stuck', slot, k, at, fast: false, who: seat(slot) });
          });
          this.insert({ ...e, at: beat + STUCK_MS, fast: false, who: '' });
          break;
        }
      }
    }
  }

  /**
   * Calls `fn` for every action due at `now`, in order, and drops them. Runs every frame, so it
   * allocates nothing (`fn` must not add to the timeline).
   */
  drain(now: number, fn: (a: Action) => void): void {
    const q = this.queue;
    let n = 0;
    while (n < q.length && (q[n] as Action).at <= now) n += 1;
    if (n === 0) return;
    for (let i = 0; i < n; i++) fn(q[i] as Action);
    q.copyWithin(0, n);
    q.length -= n;
  }

  /** Everything still pending, at once (retry, undo, leaving the scene). */
  flush(fn: (a: Action) => void): void {
    const all = this.queue.splice(0, this.queue.length);
    for (const a of all) fn({ ...a, fast: true });
  }

  get pending(): number {
    return this.queue.length;
  }

  /** Squeezes the pending actions, in order, into (now, now + FAST_FORWARD_MS]. */
  private fastForward(now: number): void {
    const n = this.queue.length;
    this.queue.forEach((a, i) => {
      a.at = Math.min(a.at, now + ((i + 1) / n) * FAST_FORWARD_MS);
      a.fast = true;
    });
    // min() keeps actions already due earlier; the order holds because both sequences rise.
  }

  /** Keeps the queue sorted by time; equal times keep their insertion order. */
  private insert(a: Action): void {
    let i = this.queue.length;
    while (i > 0 && (this.queue[i - 1] as Action).at > a.at) i -= 1;
    this.queue.splice(i, 0, a);
  }
}

/** One tap's cascade, measured from the tap (D5). */
export interface Cascade {
  /** When its last motion ends: the motion the player does not drive. */
  ms: number;
  /** When its last timeline action plays (the timeline is drained; the capture taps again). */
  drained: number;
  /** Full meals in it. */
  fulls: number;
}

/**
 * How long one tap's cascade runs (D5; GDD §3a "cascade per input"), played alone from the tap:
 * the hop with its landing squash, each flight and the crumbs it leaves, a wake's jump, a full
 * meal's bounce and waddle; every full meal's hit stop holds all motion, so it adds to the
 * length. The win reveal and the stuck beat are the level's own beats, not part of a cascade
 * (they count in `drained` only).
 */
export function cascade(events: readonly GameEvent[]): Cascade {
  const t = new Timeline();
  t.add(events, 0);
  let end = 0;
  let last = 0;
  const fullsAt: number[] = [];
  t.drain(Number.POSITIVE_INFINITY, (a) => {
    last = Math.max(last, a.at);
    switch (a.kind) {
      case 'hop':
        end = Math.max(end, a.at + HOP_MS + HOP_SQUASH_MS);
        break;
      case 'bite':
        end = Math.max(end, a.at + Math.max(BITE_FLIGHT_MS, CRUMB_MS));
        break;
      case 'wake':
        end = Math.max(end, a.at + WAKE_MS);
        break;
      case 'full':
        fullsAt.push(a.at);
        end = Math.max(end, a.at + FULL_BOUNCE_MS + LEAVE_MS);
        break;
      case 'won':
      case 'stuck':
      case 'lost':
        // the level's own beats (audit fix: they used to stretch the lost tap's cascade)
        break;
      default:
        end = Math.max(end, a.at);
        break;
    }
  });
  const stopsBefore = fullsAt.filter((at) => at < last).length * FULL_HIT_STOP_MS;
  return {
    ms: end + fullsAt.length * FULL_HIT_STOP_MS,
    drained: last + stopsBefore,
    fulls: fullsAt.length,
  };
}
