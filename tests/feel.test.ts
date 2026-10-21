import { describe, expect, it } from 'vitest';
import { PALETTE } from '../src/data/palette';
import {
  BELLY_SWELL_CAP,
  BELLY_SWELL_PER_BITE,
  BITE_CENTS_PER_BITE,
  BITE_FLIGHT_MS,
  BITE_INTERVAL_MS,
  BITE_PITCH_STEPS,
  COMBO_CENTS_PER_STEP,
  COMBO_STEP_CAP,
  ComboCounter,
  SoundFrameGate,
  CRUMBS_PER_BITE,
  FAST_FLIGHT_MS,
  FAST_FORWARD_MS,
  FULL_BOUNCE_SCALE,
  FULL_HIT_STOP_MS,
  FULL_LAST_BITE_DB,
  FULL_SHAKE_INTENSITY,
  FULL_SHAKE_MS,
  GAIN,
  HOP_CENTS_PER_COLOUR,
  HOP_MS,
  HOP_SQUASH_MS,
  HOP_SQUASH_X,
  HOP_SQUASH_Y,
  LEAVE_MS,
  NOPE_SHAKE_MS,
  NOPE_SHAKE_PX,
  OCTAVE_CENTS,
  PANEL_GUARD_MS,
  PANEL_SLIDE_MS,
  SFX_FILE_DB,
  SHAKE_STEP_GAIN,
  STUCK_MS,
  STUCK_STAGGER_MS,
  WAKE_JUMP_PX,
  WAKE_MS,
  WIN_BEAT_MS,
  WIN_FACE_SCALE,
  WIN_HIT_STOP_MS,
  WIN_SHAKE_INTENSITY,
  WIN_SHAKE_MS,
  bellyScale,
  biteDetune,
  dbGain,
  hopDetune,
  kickIntensity,
  playedDb,
  sumDb,
  type FeelSound,
} from '../src/game/feel';

/** GDD §3a: the right move is the loudest moment; failure stays local and soft. */
describe('feel (GDD §3a)', () => {
  it('pins the Feel spec values', () => {
    expect([HOP_SQUASH_X, HOP_SQUASH_Y, HOP_SQUASH_MS, HOP_MS]).toEqual([1.15, 0.85, 80, 220]);
    expect([BITE_FLIGHT_MS, BITE_INTERVAL_MS, CRUMBS_PER_BITE]).toEqual([200, 70, 3]);
    expect([BELLY_SWELL_PER_BITE, BELLY_SWELL_CAP]).toEqual([0.03, 0.3]);
    expect([BITE_CENTS_PER_BITE, BITE_PITCH_STEPS]).toEqual([100, 12]);
    expect([FULL_HIT_STOP_MS, FULL_BOUNCE_SCALE, LEAVE_MS, FULL_LAST_BITE_DB]).toEqual([
      45, 1.2, 300, 2,
    ]);
    expect([FULL_SHAKE_MS, FULL_SHAKE_INTENSITY, SHAKE_STEP_GAIN, COMBO_STEP_CAP]).toEqual([
      70, 0.002, 0.25, 3,
    ]);
    expect([WAKE_JUMP_PX, NOPE_SHAKE_PX, NOPE_SHAKE_MS, GAIN.nope]).toEqual([30, 6, 40, 0.5]);
    expect([WIN_BEAT_MS, WIN_HIT_STOP_MS, WIN_FACE_SCALE]).toEqual([250, 60, 1.08]);
    expect([WIN_SHAKE_MS, WIN_SHAKE_INTENSITY]).toEqual([120, 0.0045]);
    expect([STUCK_STAGGER_MS, STUCK_MS, GAIN.stuck]).toEqual([80, 600, 0.6]);
    expect([FAST_FORWARD_MS, FAST_FLIGHT_MS]).toEqual([150, 80]);
    // D1 and D3 (docs/questions.md 2026-10-21)
    expect([COMBO_CENTS_PER_STEP, HOP_CENTS_PER_COLOUR, OCTAVE_CENTS]).toEqual([100, 100, 1200]);
  });

  it('bite pitch: +100 cents per bite, flat after 12 steps, the combo raises the base', () => {
    const meal = Array.from({ length: 16 }, (_, i) => biteDetune(i + 1, 0));
    expect(meal.slice(0, 13)).toEqual(meal.slice(0, 13).map((_, i) => 100 * i));
    // D2: from the 13th bite of a meal on the pitch stays at +1200 cents
    expect(meal.slice(12)).toEqual([1200, 1200, 1200, 1200]);
    // D1: each combo step lifts the whole meal by 100 cents, capped with the step
    expect([0, 1, 2, 3, 4].map((s) => biteDetune(1, s))).toEqual([0, 100, 200, 300, 300]);
    expect(biteDetune(13, 3)).toBe(1500);
    expect(biteDetune(0, -1)).toBe(0);
  });

  it('hop pitch follows the palette index within an octave', () => {
    const keys = Object.keys(PALETTE);
    const cents = keys.map((_, i) => hopDetune(i));
    expect(cents.slice(0, 12)).toEqual(cents.slice(0, 12).map((_, i) => 100 * i));
    for (const c of cents) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(OCTAVE_CENTS);
    }
    // the 13th colour wraps round to the first one's pitch
    expect(hopDetune(12)).toBe(hopDetune(0));
    expect(hopDetune(-1)).toBe(0);
  });

  it('belly: +3 % per bite, capped at 30 %', () => {
    expect(bellyScale(0)).toBe(1);
    expect(bellyScale(1)).toBeCloseTo(1.03, 10);
    expect(bellyScale(5)).toBeCloseTo(1.15, 10);
    expect(bellyScale(10)).toBeCloseTo(1.3, 10);
    expect(bellyScale(11)).toBeCloseTo(1.3, 10);
    expect(bellyScale(400)).toBeCloseTo(1.3, 10);
  });

  it('squeezed sounds (D4): one of a kind per frame; a restarted level forgets the old frames', () => {
    const gate = new SoundFrameGate<'bite' | 'burp'>();
    expect(gate.take('bite', 37)).toBe(true);
    expect(gate.take('bite', 37)).toBe(false);
    expect(gate.take('burp', 37)).toBe(true);
    expect(gate.take('bite', 38)).toBe(true);
    // the scene's frame count starts over with the level: frame 38 is a new frame again
    gate.reset();
    expect(gate.take('bite', 38)).toBe(true);
    expect(gate.take('burp', 37)).toBe(true);
  });

  it('combo: a full in a row +1, a wait resets, cap 3', () => {
    const c = new ComboCounter();
    expect(c.step).toBe(0);
    expect([c.full(), c.full(), c.full(), c.full(), c.full()]).toEqual([0, 1, 2, 3, 3]);
    expect(c.step).toBe(3);
    c.wait();
    expect(c.step).toBe(0);
    expect([c.full(), c.full()]).toEqual([0, 1]);
    c.reset();
    expect(c.full()).toBe(0);
  });

  it('the kick grows with the combo step, stays small, and the win kick tops it', () => {
    const k = [0, 1, 2, 3, 4].map(kickIntensity);
    expect(k[0]).toBe(FULL_SHAKE_INTENSITY);
    expect(k[1]).toBeCloseTo(FULL_SHAKE_INTENSITY * 1.25, 12);
    for (let i = 1; i < 4; i++) expect(k[i]).toBeGreaterThan(k[i - 1] as number);
    expect(k[4]).toBe(k[3]);
    expect(kickIntensity(-2)).toBe(FULL_SHAKE_INTENSITY);
    expect(k[3]).toBeLessThanOrEqual(0.005);
    expect(WIN_SHAKE_INTENSITY).toBeGreaterThan(k[3] as number);
    expect(WIN_SHAKE_INTENSITY).toBeLessThanOrEqual(0.005);
    expect(WIN_SHAKE_MS).toBeGreaterThan(FULL_SHAKE_MS);
  });

  it('as played, the full meal and the win outweigh the nope, the wait and the stuck', () => {
    const lastBite = playedDb('bite', FULL_LAST_BITE_DB);
    const full = Math.max(lastBite, playedDb('burp'));
    expect(full).toBeGreaterThanOrEqual(playedDb('nope') + 6);
    expect(full).toBeGreaterThanOrEqual(playedDb('wait') + 6);
    expect(playedDb('win')).toBeGreaterThanOrEqual(playedDb('stuck') + 6);
    // a lost tap plays the last wait and the stuck together: still under a full meal and a win
    const loss = sumDb([playedDb('wait'), playedDb('stuck')]);
    expect(loss).toBeLessThan(full);
    expect(loss).toBeLessThan(playedDb('win'));
    // the nope is the quietest cue of the game
    const nope = playedDb('nope');
    for (const s of Object.keys(GAIN) as FeelSound[]) {
      if (s !== 'nope') expect(playedDb(s), s).toBeGreaterThan(nope);
    }
    // the last bite of a meal is louder than the others, and never clips the SFX bus
    expect(lastBite - playedDb('bite')).toBeCloseTo(FULL_LAST_BITE_DB, 10);
    expect(dbGain(FULL_LAST_BITE_DB)).toBeCloseTo(1.2589, 4);
    for (const s of Object.keys(GAIN) as FeelSound[]) expect(SFX_FILE_DB[s], s).toBeLessThan(0);
  });

  it('decibel helpers: power sums and gains', () => {
    expect(sumDb([-20, -20])).toBeCloseTo(-20 + 10 * Math.log10(2), 10);
    expect(sumDb([-12])).toBeCloseTo(-12, 10);
    expect(playedDb('nope')).toBeCloseTo(SFX_FILE_DB.nope + 20 * Math.log10(0.5), 10);
    expect(dbGain(0)).toBe(1);
  });

  it('timings: short hit stops, a felt win beat, the stuck faces inside the stuck beat', () => {
    for (const ms of [FULL_HIT_STOP_MS, WIN_HIT_STOP_MS]) {
      expect(ms).toBeGreaterThanOrEqual(40);
      expect(ms).toBeLessThanOrEqual(60);
    }
    // the squash is the take-off of the hop, not a wait before it
    expect(HOP_SQUASH_MS).toBeLessThan(HOP_MS);
    expect(WIN_BEAT_MS).toBeGreaterThanOrEqual(200);
    // five stuck faces turn one by one before the panel comes
    expect(4 * STUCK_STAGGER_MS).toBeLessThan(STUCK_MS);
    // the lose panel is in place before it takes a press (Epic 3 guard)
    expect(PANEL_SLIDE_MS).toBeLessThanOrEqual(PANEL_GUARD_MS);
    // a waking muncher's jump fits before its first bite
    expect(WAKE_MS).toBeGreaterThan(0);
  });
});
