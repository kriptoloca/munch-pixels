/**
 * Feel constants (GDD §3a, the Feel spec). Starting values to tune on Hasan's phone; every one
 * is named here so tuning never touches the scene code. Epic 3 uses the timings; the juice
 * (squash, kick, hit stop, pitch) arrives in Epic 4.
 */

/** Tap → the muncher hops on an arc into its slot. */
export const HOP_MS = 220;
/** A seated muncher takes a bite this often (the bite stream). */
export const BITE_INTERVAL_MS = 70;
/** A bitten pixel flies into the mouth in this long. */
export const BITE_FLIGHT_MS = 200;
/** A full muncher waddles off in this long. */
export const LEAVE_MS = 300;
/** A waiting muncher wakes with a jump this long before its first bite. */
export const WAKE_MS = 120;
/** The last pixel gets its own beat before the win reveal. */
export const WIN_BEAT_MS = 250;
/** The stuck faces play this long before the lose panel. */
export const STUCK_MS = 600;
/**
 * A new tap squeezes whatever is still playing from earlier taps into this window, so the new
 * muncher never waits for an old animation (docs/questions.md, Epic 3 timeline). A muncher
 * leaving a slot can still fade out while the next one flies in (by design: they overlap for
 * at most a few frames).
 */
export const FAST_FORWARD_MS = 150;
/** Flights and exits of fast-forwarded actions. */
export const FAST_FLIGHT_MS = 80;
/** Nope (GDD §3a): the muncher behind the front shakes its head ±6 px, two swings of 40 ms. */
export const NOPE_SHAKE_PX = 6;
export const NOPE_SHAKE_MS = 40;
/** A waking muncher jumps this high (the front of a den bobs half as high after a nope). */
export const WAKE_JUMP_PX = 30;
/** Bitten pixels shrink to this scale on their way into the mouth. */
export const BITE_END_SCALE = 0.35;
/** A muncher joining the visible queue fades in over this long. */
export const QUEUE_REVEAL_MS = 160;
/**
 * Tweens run on their own wall clock, the timeline on the scene's: both skip a stall longer than
 * LAG_LIMIT_MS as if one LAG_SKIP_MS frame had passed, so a short host pause or a hitch never
 * lets the flights run ahead of the bites (Phaser TweenManager.setLagSmooth).
 */
export const LAG_LIMIT_MS = 200;
export const LAG_SKIP_MS = 33;
/** Taps on the dens are ignored this long after a level starts, presses on a panel this long
 * after it opens (a double tap never skips the reveal or plays the next level's first move). */
export const LEVEL_START_GUARD_MS = 250;
export const PANEL_GUARD_MS = 300;
