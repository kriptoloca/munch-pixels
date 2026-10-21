// Placeholder sound synthesis for the audio pipeline (scripts/audio.mjs): the GDD §11 sound set
// and a 16 s music loop, rendered deterministically as mono 44.1 kHz float samples. Ported from
// Peek & Find (tone, noise, mix, arpeggio, WAV); the sounds and the loop are Munch Pixels' own.
// Real files under assets/audio/ replace them one by one (D14: the placeholders ship first).

export const SAMPLE_RATE = 44100;
const TAU = Math.PI * 2;

/** GDD §11; kept in sync with src/data/audio-manifest.json and the feel gains by a test. */
export const SFX_NAMES = [
  'hop',
  'bite',
  'burp',
  'perk',
  'wait',
  'nope',
  'win',
  'stuck',
  'pop',
  'undo',
  'button',
];
export const MUSIC_NAME = 'music_loop';

/** Every SFX is normalized to this peak (the loop to MUSIC_PEAK). */
const SFX_PEAK = 0.8;
/**
 * Peek & Find's phone-speaker lesson (docs/audio-review.md there): a loop at peak 0.5 × volume
 * 0.35 was not heard on an iPhone speaker; peak 0.85 played at 0.5 is.
 */
const MUSIC_PEAK = 0.85;

/** mulberry32, same family as the game's Rng; deterministic noise. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wave(type, phase) {
  const p = phase % 1;
  switch (type) {
    case 'tri':
      return 1 - 4 * Math.abs(p - 0.5);
    case 'soft': // odd harmonics 1, 3, 5 with 1/n² amplitude: a rounded square
      return (Math.sin(TAU * p) + Math.sin(TAU * 3 * p) / 9 + Math.sin(TAU * 5 * p) / 25) / 1.15;
    case 'bell': // inharmonic partial typical of a struck bar
      return Math.sin(TAU * p) * 0.8 + Math.sin(TAU * 2.76 * p) * 0.25;
    case 'reed': // harmonics 1..4 falling off: a buzzy, rounded voice (the burp)
      return (
        (Math.sin(TAU * p) +
          0.6 * Math.sin(TAU * 2 * p) +
          0.4 * Math.sin(TAU * 3 * p) +
          0.25 * Math.sin(TAU * 4 * p)) /
        1.8
      );
    default:
      return Math.sin(TAU * p);
  }
}

/**
 * One enveloped tone.
 * @param {{ freq: number, dur: number, type?: string, attack?: number, decay?: number,
 *   gain?: number, slide?: number, vibrato?: number, am?: number, amDepth?: number }} o
 *   slide = frequency multiplier reached at the end (1 = none), vibrato = depth in percent,
 *   am = amplitude modulation rate (Hz) with depth amDepth (0..1): the burp's flutter
 * @returns {Float32Array}
 */
export function tone(o) {
  const n = Math.round(o.dur * SAMPLE_RATE);
  const out = new Float32Array(n);
  const attack = o.attack ?? 0.004;
  const decay = o.decay ?? o.dur;
  const gain = o.gain ?? 0.5;
  const slide = o.slide ?? 1;
  const vib = o.vibrato ?? 0;
  const am = o.am ?? 0;
  const amDepth = o.amDepth ?? 0;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const f = o.freq * Math.pow(slide, t / o.dur) * (1 + vib * 0.01 * Math.sin(TAU * 6 * t));
    phase += f / SAMPLE_RATE;
    const a = t < attack ? t / attack : 1;
    const d = Math.exp((-4.5 * Math.max(0, t - attack)) / decay);
    const m = am > 0 ? 1 - amDepth * (0.5 + 0.5 * Math.sin(TAU * am * t)) : 1;
    out[i] = wave(o.type ?? 'sine', phase) * a * d * m * gain;
  }
  return out;
}

/** White noise burst with exponential decay and a one-pole low-pass. */
export function noise({ dur, decay = dur, gain = 0.3, seed = 1, cutoff = 0.3 }) {
  const n = Math.round(dur * SAMPLE_RATE);
  const out = new Float32Array(n);
  const rnd = prng(seed);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const x = rnd() * 2 - 1;
    y += cutoff * (x - y);
    out[i] = y * Math.exp((-4.5 * t) / decay) * gain;
  }
  return out;
}

/** Adds `src` into `dest` starting at `at` seconds (dest grows as needed). */
export function mix(dest, src, at = 0, gain = 1) {
  const off = Math.round(at * SAMPLE_RATE);
  const need = off + src.length;
  let out = dest;
  if (need > dest.length) {
    out = new Float32Array(need);
    out.set(dest);
  }
  for (let i = 0; i < src.length; i++) out[off + i] += src[i] * gain;
  return out;
}

export function normalize(buf, peak = SFX_PEAK) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max === 0) return buf;
  const k = peak / max;
  for (let i = 0; i < buf.length; i++) buf[i] *= k;
  return buf;
}

/** Short fade at both ends so clips never click. */
function fadeEdges(buf, ms = 4) {
  const n = Math.min(buf.length >> 1, Math.round((ms / 1000) * SAMPLE_RATE));
  for (let i = 0; i < n; i++) {
    const k = i / n;
    buf[i] *= k;
    buf[buf.length - 1 - i] *= k;
  }
  return buf;
}

function arpeggio(freqs, gap, each, type = 'tri', gain = 0.4, decay = each) {
  let out = new Float32Array(0);
  freqs.forEach((f, i) => {
    out = mix(out, tone({ freq: f, dur: each, type, gain, decay }), i * gap);
  });
  return out;
}

/**
 * @param {string} name one of SFX_NAMES
 * @returns {Float32Array}
 */
export function renderSfx(name) {
  let out;
  switch (name) {
    case 'hop': // a springy up-chirp; the game raises it by the colour's palette index (D3)
      out = tone({ freq: 330, dur: 0.12, type: 'tri', decay: 0.11, slide: 2, gain: 0.5 });
      out = mix(out, tone({ freq: 660, dur: 0.06, decay: 0.03, slide: 1.5, gain: 0.12 }), 0.02);
      break;
    case 'bite': // a crisp crunch tick, 45 ms: shorter than the 70 ms bite interval
      out = tone({ freq: 900, dur: 0.045, type: 'soft', decay: 0.1, slide: 0.6, gain: 0.5 });
      out = mix(out, tone({ freq: 1800, dur: 0.03, type: 'tri', decay: 0.04, gain: 0.15 }));
      out = mix(out, noise({ dur: 0.03, decay: 0.015, gain: 0.2, seed: 5, cutoff: 0.6 }));
      break;
    case 'burp': // a short cartoon "brrp": a buzzy low voice with a flutter, falling a little
      out = tone({
        freq: 120,
        dur: 0.3,
        type: 'reed',
        attack: 0.015,
        decay: 1,
        slide: 0.8,
        am: 26,
        amDepth: 0.25,
        gain: 0.6,
      });
      out = mix(out, noise({ dur: 0.12, decay: 0.06, gain: 0.08, seed: 9, cutoff: 0.08 }));
      break;
    case 'perk': // "!": two quick rising chirps (a waiting muncher wakes)
      out = tone({ freq: 700, dur: 0.06, type: 'tri', decay: 0.04, slide: 1.2, gain: 0.45 });
      out = mix(
        out,
        tone({ freq: 1050, dur: 0.09, type: 'tri', decay: 0.06, slide: 1.25, gain: 0.45 }),
        0.055,
      );
      break;
    case 'wait': // a soft low "hmm" (a muncher sits down to wait)
      out = tone({ freq: 196, dur: 0.26, attack: 0.02, decay: 0.08, slide: 0.94, gain: 0.5 });
      out = mix(out, tone({ freq: 392, dur: 0.2, attack: 0.02, decay: 0.06, gain: 0.08 }));
      break;
    case 'nope': // a soft "uh-uh": two low, short, rounded tones
      out = tone({ freq: 247, dur: 0.05, type: 'soft', decay: 0.018, gain: 0.4 });
      out = mix(out, tone({ freq: 208, dur: 0.07, type: 'soft', decay: 0.022, gain: 0.4 }), 0.12);
      break;
    case 'win': // the jingle: a bright rising arpeggio landing on a ringing chord
      out = arpeggio([523.25, 659.25, 783.99, 1046.5], 0.08, 0.45, 'soft', 0.3, 0.8);
      out = mix(out, tone({ freq: 1046.5, dur: 0.6, type: 'bell', decay: 1.2, gain: 0.22 }), 0.32);
      out = mix(out, tone({ freq: 1318.5, dur: 0.55, type: 'bell', decay: 1.1, gain: 0.16 }), 0.36);
      out = mix(out, tone({ freq: 523.25, dur: 0.58, type: 'soft', decay: 1.2, gain: 0.22 }), 0.32);
      out = mix(out, tone({ freq: 783.99, dur: 0.58, type: 'soft', decay: 1.2, gain: 0.16 }), 0.32);
      break;
    case 'stuck': // a soft falling "wah-wah" (the level is lost; quieter than the win)
      out = tone({ freq: 330, dur: 0.2, type: 'soft', decay: 0.07, slide: 0.94, gain: 0.35 });
      out = mix(
        out,
        tone({ freq: 262, dur: 0.32, type: 'soft', decay: 0.12, slide: 0.9, gain: 0.35 }),
        0.18,
      );
      break;
    case 'pop': // the +1 slot pops in
      out = tone({ freq: 320, dur: 0.08, decay: 0.05, slide: 2.6, gain: 0.5 });
      break;
    case 'undo': // a quick falling swoosh (the bites fly back)
      out = tone({ freq: 1200, dur: 0.14, decay: 0.1, slide: 0.42, gain: 0.4 });
      out = mix(out, noise({ dur: 0.12, decay: 0.08, gain: 0.1, seed: 13, cutoff: 0.25 }));
      break;
    case 'button':
      out = tone({ freq: 1200, dur: 0.05, decay: 0.03, gain: 0.35 });
      out = mix(out, noise({ dur: 0.02, decay: 0.008, gain: 0.15, seed: 7, cutoff: 0.6 }));
      break;
    default:
      throw new Error(`no placeholder synth for ${name}`);
  }
  return fadeEdges(normalize(out, SFX_PEAK));
}

/** ii–V–I–vi in C, two bars each (Dm7, G7, Cmaj7, Am7). */
const CHORDS = [
  [146.83, 174.61, 220.0, 261.63], // Dm7
  [196.0, 246.94, 293.66, 349.23], // G7
  [130.81, 164.81, 196.0, 246.94], // Cmaj7
  [220.0, 261.63, 329.63, 392.0], // Am7
];
/** 120 bpm: a beat is 0.5 s, a bar 2 s, a chord two bars; 8 bars = 16 s. */
const BEAT_SEC = 0.5;
const BARS_PER_CHORD = 2;
const BEATS_PER_BAR = 4;
const LOOP_SEC = CHORDS.length * BARS_PER_CHORD * BEATS_PER_BAR * BEAT_SEC;
/** Eighth-note pluck pattern over the chord tones (indices), one bar long. */
const PLUCKS = [0, 2, 1, 3, 2, 1, 3, 2];

/**
 * A light, mellow 16 s loop at 120 bpm: soft pad chords, a plucked eighth-note pattern and a
 * round bass on beats one and three. Every voice ends inside the loop, so it repeats without a
 * tail spilling over; mono; peak 0.85 (played at 0.5 in game).
 * @returns {Float32Array}
 */
export function renderMusic() {
  let out = new Float32Array(Math.round(LOOP_SEC * SAMPLE_RATE));
  const chordSec = BARS_PER_CHORD * BEATS_PER_BAR * BEAT_SEC;
  CHORDS.forEach((chord, c) => {
    const t0 = c * chordSec;
    for (const f of chord) {
      out = mix(
        out,
        tone({ freq: f, dur: chordSec - 0.05, attack: 0.5, decay: 5, gain: 0.05 }),
        t0,
      );
    }
    for (let bar = 0; bar < BARS_PER_CHORD; bar++) {
      const tb = t0 + bar * BEATS_PER_BAR * BEAT_SEC;
      PLUCKS.forEach((idx, i) => {
        const f = chord[idx] * 2;
        out = mix(
          out,
          tone({ freq: f, dur: 0.3, type: 'tri', decay: 0.16, gain: 0.11 }),
          tb + (i * BEAT_SEC) / 2,
        );
      });
      for (const beat of [0, 2]) {
        out = mix(
          out,
          tone({ freq: chord[0] / 2, dur: 0.45, type: 'tri', decay: 0.3, gain: 0.16 }),
          tb + beat * BEAT_SEC,
        );
      }
    }
  });
  // trim to the exact loop length so a tail never spills past the last bar
  const exact = new Float32Array(out.subarray(0, Math.round(LOOP_SEC * SAMPLE_RATE)));
  return fadeEdges(normalize(exact, MUSIC_PEAK), 12);
}

/** 16-bit PCM mono WAV. */
export function toWav(samples, rate = SAMPLE_RATE) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v < 0 ? v * 32768 : v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
