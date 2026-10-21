import type { HapticKind } from '../platform/haptics';

/**
 * Feel constants and helpers (GDD §3a, the Feel spec; `pebblit-game-craft`). The right move is
 * the loudest moment; failure stays local and soft. Every value is a starting point to tune on
 * Hasan's phone, named here so tuning never touches the scene code. Pure: no Phaser, no clock.
 * Decisions D1–D15 (docs/questions.md, 2026-10-21) fill the values the GDD leaves open.
 */

// ---- the feel log (dev builds: e2e, the capture, the gamer) ---------------------------------

/** One moment of feel the Game scene played (dev state `feel`, newest last). */
export interface FeelEvent {
  kind: 'hop' | 'bite' | 'full' | 'wake' | 'wait' | 'nope' | 'win' | 'stuck';
  /** Scene clock (ms) when it played: stops under a pause and inside a hit stop. */
  t: number;
  /** Timeline actions: the scene time it was scheduled for (≤ t; t is the frame it drained on). */
  at?: number;
  /** performance.now() (ms): the capture cuts its clip on the wall clock. */
  wall: number;
  level: number;
  /** The muncher (`lane:index`), where one is involved. */
  who?: string;
  slot?: number;
  /** Bites of this meal so far (the bite's n); the stuck beat: munchers turning down. */
  n?: number;
  /** Pitch of the sound in cents. */
  detune?: number;
  /** Combo step (a full's own step; a bite's meal base). */
  step?: number;
  /** Camera kick intensity; 0 = no kick. */
  shake?: number;
  /** Hit stop length (ms, before `feelslow`); 0 = none. */
  hitStop?: number;
  /** Gain of the sound as asked (GAIN × the +2 dB of a last bite); 0 = no sound. */
  gain?: number;
  haptic?: HapticKind | null;
  /** Squeezed by a later tap (D4). */
  fast?: boolean;
  /** Height of a jump or a bob (px): the wake, the front muncher after a nope. */
  jump?: number;
}

// ---- tap a front muncher: the hop -------------------------------------------------------------

/** Tap → the muncher hops on an arc into its slot. */
export const HOP_MS = 220;
/** Take-off and landing squash (GDD §3a: 1.15/0.85 for 80 ms). */
export const HOP_SQUASH_X = 1.15;
export const HOP_SQUASH_Y = 0.85;
export const HOP_SQUASH_MS = 80;
/** Height of the hop's arc above the straight path, as a share of the slot size. */
export const HOP_ARC_SHARE = 0.55;
/** D3: the hop sound rises 100 cents per palette index, wrapped in one octave. */
export const HOP_CENTS_PER_COLOUR = 100;
export const OCTAVE_CENTS = 1200;

// ---- the bite stream ----------------------------------------------------------------------

/** A seated muncher takes a bite this often (the bite stream). */
export const BITE_INTERVAL_MS = 70;
/** A bitten pixel flies into the mouth in this long. */
export const BITE_FLIGHT_MS = 200;
/** The pixel lifts: it grows to this scale over the first share of its flight… */
export const BITE_LIFT_SCALE = 1.25;
export const BITE_LIFT_SHARE = 0.2;
/** …then shrinks to this scale at the mouth. */
export const BITE_END_SCALE = 0.35;
/** Arc height of a flight: this share of its length, at least BITE_ARC_MIN_PX. */
export const BITE_ARC_SHARE = 0.25;
export const BITE_ARC_MIN_PX = 40;
/** Crumbs in the pixel's colour burst where it stood. */
export const CRUMBS_PER_BITE = 3;
export const CRUMB_MS = 280;
/** Crumb size and how far they scatter and drop, in cells. */
export const CRUMB_SIZE_SHARE = 0.4;
export const CRUMB_SPREAD_CELLS = 0.9;
export const CRUMB_DROP_CELLS = 0.7;
/** A crumb hops up this share of its drop before it falls. */
export const CRUMB_HOP_SHARE = 0.5;
/** The belly swells 3 % per bite, capped at 30 % (wider; half as much taller). */
export const BELLY_SWELL_PER_BITE = 0.03;
export const BELLY_SWELL_CAP = 0.3;
export const BELLY_TALL_SHARE = 0.5;
/** A landing pixel squeezes the muncher a little (the gulp: a visual tick per bite). */
export const GULP_SQUASH = 0.06;
export const GULP_MS = 60;
/** Bite pitch: +100 cents per bite of the meal, flat after 12 steps (D2). */
export const BITE_CENTS_PER_BITE = 100;
export const BITE_PITCH_STEPS = 12;
/** D1: each combo step lifts a meal's bites by this much. */
export const COMBO_CENTS_PER_STEP = 100;

// ---- the full meal and the combo ------------------------------------------------------------

/** The last bite of a meal plays this much louder (dB). */
export const FULL_LAST_BITE_DB = 2;
/** Hit stop on a full meal: tweens and the scene clock stand still this long (wall clock). */
export const FULL_HIT_STOP_MS = 45;
/** The full-meal kick: camera shake length and base intensity (no kick on a squeezed full). */
export const FULL_SHAKE_MS = 70;
export const FULL_SHAKE_INTENSITY = 0.002;
/** Each combo step adds this share of the base kick. */
export const SHAKE_STEP_GAIN = 0.25;
/** Finishes in a row without a muncher sitting down to wait; the first finish is step 0. */
export const COMBO_STEP_CAP = 3;
/** Belly bounce of a full muncher (up and back), then it waddles off. */
export const FULL_BOUNCE_SCALE = 1.2;
export const FULL_BOUNCE_MS = 120;
/** A full muncher waddles off in this long: it rises this share of a slot, rocking. */
export const LEAVE_MS = 300;
export const LEAVE_RISE_SHARE = 0.6;
export const WADDLE_ANGLE = 0.18;
export const WADDLE_SWINGS = 2;
/** Burp puff: small clouds rise from the mouth and fade. */
export const PUFF_COUNT = 3;
export const PUFF_MS = 320;
/** Puff size and rise, as shares of the muncher size; puffs start at this share of their size. */
export const PUFF_SIZE_SHARE = 0.16;
export const PUFF_RISE_SHARE = 0.55;
export const PUFF_START_SCALE = 0.4;

// ---- chain and waiting ---------------------------------------------------------------------

/** A waiting muncher wakes with a jump this long before its first bite… */
export const WAKE_MS = 120;
/** …this high, eyes wide. */
export const WAKE_JUMP_PX = 30;

// ---- nope -----------------------------------------------------------------------------------

/** Nope (GDD §3a): the muncher behind the front shakes its head ±6 px, two swings of 40 ms. */
export const NOPE_SHAKE_PX = 6;
export const NOPE_SHAKE_MS = 40;
/** The front muncher of its lane bobs once, this high (it is the one to tap). */
export const NOPE_BOB_PX = 15;

// ---- the win --------------------------------------------------------------------------------

/** The last pixel gets its own beat before the win reveal. */
export const WIN_BEAT_MS = 250;
/** Win hit stop, then the face blinks and grows 1.08× with a bounce. */
export const WIN_HIT_STOP_MS = 60;
export const WIN_FACE_SCALE = 1.08;
export const WIN_GROW_MS = 320;
/** The face keeps its eyes shut this long (one blink), then opens them with the grin (D6). */
export const WIN_BLINK_MS = 140;
/** The win kick: the biggest of the game. */
export const WIN_SHAKE_MS = 120;
export const WIN_SHAKE_INTENSITY = 0.0045;
/** Confetti in the level's own fill colours (no tint). */
export const CONFETTI_COUNT = 36;
export const CONFETTI_MS = 1100;
/** Confetti piece size (design px), how high it bursts and how far it falls, in board sizes. */
export const CONFETTI_PX = 16;
export const CONFETTI_RISE_SHARE = 0.35;
export const CONFETTI_FALL_SHARE = 0.9;
/** Sideways drift (board widths), spin (turns), launch stagger between waves (ms). */
export const CONFETTI_DRIFT_SHARE = 0.25;
export const CONFETTI_TURNS = 1.5;
export const CONFETTI_STAGGER_MS = 30;
/** The confetti leaves in this many waves, CONFETTI_STAGGER_MS apart (piece i in wave i mod n). */
export const CONFETTI_WAVES = 4;
/** A confetti piece rises for this share of its life, then falls; it fades over the last share. */
export const CONFETTI_RISE_PART = 1 / 3;
export const CONFETTI_FADE_PART = 0.3;

// ---- effect motion shapes (src/game/fx.ts) --------------------------------------------------

/** Crumbs and confetti fall on this power of time (2: a thrown object's parabola). */
export const FX_FALL_POWER = 2;
/** Scatter values vary a launch around its base by up to this share (crumb drop, confetti). */
export const FX_VARY = 0.5;
/** Golden-ratio step: scatter values spread evenly without randomness (same every replay). */
export const FX_GOLDEN_STEP = 0.6180339887;

// ---- stuck (lose) ---------------------------------------------------------------------------

/** The waiting munchers turn their faces down one by one, this far apart… */
export const STUCK_STAGGER_MS = 80;
/** …and the lose panel comes this long after the last muncher sat down. */
export const STUCK_MS = 600;
/** The panel slides up into place in this long (in place before PANEL_GUARD_MS). */
export const PANEL_SLIDE_MS = 250;

// ---- squeezed playback (D4) -----------------------------------------------------------------

/**
 * A new tap squeezes whatever is still playing from earlier taps into this window, so the new
 * muncher never waits for an old animation (docs/questions.md, Epic 3 timeline). A squeezed
 * action gets no hit stop, no kick, no haptic and at most one sound of a kind per frame (D4).
 */
export const FAST_FORWARD_MS = 150;
/** Flights and exits of fast-forwarded actions. */
export const FAST_FLIGHT_MS = 80;

// ---- clocks and guards (Epic 3) -------------------------------------------------------------

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
/** Dev `?feelslow=K` (D15) stretches every feel timing K times, at most this much. */
export const FEEL_SLOW_MAX = 20;

// ---- sound levels ---------------------------------------------------------------------------

/** Master SFX volume; each sound is scaled by its GAIN on top (src/game/audio.ts). */
export const SFX_VOLUME = 0.6;
/** Music volume. Peek & Find docs/audio-review.md: 0.35 was inaudible on an iPhone speaker. */
export const MUSIC_VOLUME = 0.5;

/**
 * Gains of the sound effects, relative to the SFX volume. The files differ in level
 * (SFX_FILE_DB), so the gains carry the difference: as played, the full meal and the win are
 * the loudest moments and the nope the quietest cue (`playedDb`, tests/feel.test.ts).
 */
export const GAIN = {
  hop: 0.6,
  bite: 0.7,
  burp: 1,
  perk: 0.7,
  wait: 0.55,
  nope: 0.5,
  win: 1,
  stuck: 0.6,
  pop: 0.8,
  undo: 0.7,
  button: 0.6,
} as const;

/** Every sound effect has a gain (src/game/audio-keys.ts names the same set). */
export type FeelSound = keyof typeof GAIN;

/**
 * Mean level (RMS, dBFS) of the shipped files the gains were set for: the synthesized
 * placeholders, measured 2026-10-21 with ffmpeg volumedetect on public/audio/*.ogg.
 * tests/audio.test.ts re-measures them, so a new sound file fails the test until these follow.
 */
export const SFX_FILE_DB: Record<FeelSound, number> = {
  hop: -15.9,
  bite: -11.3,
  burp: -12.8,
  perk: -17.6,
  wait: -17.2,
  nope: -18,
  win: -13.6,
  stuck: -17.3,
  pop: -15.3,
  undo: -16.1,
  button: -15.2,
};

/** Linear gain of a level change in dB. */
export function dbGain(db: number): number {
  return 10 ** (db / 20);
}

/** Level of a sound as played, in dB: file level + gain (+ `extraDb`, the last bite's lift). */
export function playedDb(sound: FeelSound, extraDb = 0): number {
  return SFX_FILE_DB[sound] + 20 * Math.log10(GAIN[sound]) + extraDb;
}

/** Level of sounds played together (power sum), in dB. */
export function sumDb(levels: readonly number[]): number {
  return 10 * Math.log10(levels.reduce((sum, db) => sum + 10 ** (db / 10), 0));
}

// ---- pure helpers ---------------------------------------------------------------------------

function clampStep(step: number): number {
  return Math.max(0, Math.min(COMBO_STEP_CAP, Math.floor(step)));
}

/**
 * The combo (GDD §3a): munchers that finished in a row without any muncher sitting down to wait;
 * the first finish is step 0, capped. Fed by the full and wait actions as they play.
 */
export class ComboCounter {
  private inRow = 0;

  /** The step the next finish gets (a meal's bites take it as their base pitch, D1). */
  get step(): number {
    return clampStep(this.inRow);
  }

  /** A muncher finished: its step. */
  full(): number {
    const s = this.step;
    this.inRow += 1;
    return s;
  }

  /** A muncher sat down to wait: the run is over. */
  wait(): void {
    this.inRow = 0;
  }

  reset(): void {
    this.inRow = 0;
  }
}

/**
 * D4: a squeezed action plays at most one sound of a kind per frame. The scene's frame count
 * starts over with every level, so the gate does too (`reset`): a frame number from the last
 * level must not silence a sound of this one.
 */
export class SoundFrameGate<K extends string> {
  private readonly last = new Map<K, number>();

  /** True when `kind` has not sounded in `frame` yet (and marks it sounded). */
  take(kind: K, frame: number): boolean {
    if (this.last.get(kind) === frame) return false;
    this.last.set(kind, frame);
    return true;
  }

  reset(): void {
    this.last.clear();
  }
}

/** D1, D2: pitch of the n-th bite of a meal (n ≥ 1) at a combo step, in cents. */
export function biteDetune(n: number, step: number): number {
  const rise = Math.max(0, Math.min(BITE_PITCH_STEPS, Math.floor(n) - 1));
  return BITE_CENTS_PER_BITE * rise + COMBO_CENTS_PER_STEP * clampStep(step);
}

/** D3: pitch of a hop by the colour's palette index, wrapped in one octave, in cents. */
export function hopDetune(paletteIndex: number): number {
  const i = Math.max(0, Math.floor(paletteIndex));
  return (HOP_CENTS_PER_COLOUR * i) % OCTAVE_CENTS;
}

/** Camera kick of a full meal at a combo step. */
export function kickIntensity(step: number): number {
  return FULL_SHAKE_INTENSITY * (1 + SHAKE_STEP_GAIN * clampStep(step));
}

/** Width of a muncher's belly after n bites (1 = as it sat down). */
export function bellyScale(n: number): number {
  return 1 + Math.min(BELLY_SWELL_CAP, BELLY_SWELL_PER_BITE * Math.max(0, n));
}
