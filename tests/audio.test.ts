import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import manifest from '../src/data/audio-manifest.json';
import { MUSIC_KEY, SFX_NAMES } from '../src/game/audio-keys';
import { BITE_INTERVAL_MS, GAIN, SFX_FILE_DB, type FeelSound } from '../src/game/feel';
import {
  MUSIC_NAME,
  SAMPLE_RATE,
  SFX_NAMES as SYNTH_NAMES,
  renderMusic,
  renderSfx,
  toWav,
} from '../scripts/lib/synth.mjs';

const ROOT = new URL('../', import.meta.url);
/** GDD §11: the sound set, in the manifest's order. */
const GDD_SET = [
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

function peakOf(a: Float32Array): number {
  let peak = 0;
  for (const v of a) peak = Math.max(peak, Math.abs(v));
  return peak;
}

describe('audio manifest (GDD §11)', () => {
  it('the manifest, the synth and the feel gains name the same sounds', () => {
    expect(manifest.sfx).toEqual(GDD_SET);
    expect(SYNTH_NAMES).toEqual(manifest.sfx);
    expect(Object.keys(GAIN).sort()).toEqual([...manifest.sfx].sort());
    expect(Object.keys(SFX_FILE_DB).sort()).toEqual([...manifest.sfx].sort());
    expect(MUSIC_NAME).toBe(manifest.music);
    expect(manifest.music).toBe('music_loop');
  });

  it('the game plays the manifest by name (src/game/audio-keys.ts)', () => {
    expect([...SFX_NAMES]).toEqual(manifest.sfx);
    expect(MUSIC_KEY).toBe(manifest.music);
  });
});

describe('placeholder synth', () => {
  it('renders every SFX deterministically, short and within the peak', () => {
    for (const name of SYNTH_NAMES) {
      const a = renderSfx(name);
      const b = renderSfx(name);
      expect(a.length, name).toBeGreaterThan(SAMPLE_RATE * 0.02);
      expect(a.length, name).toBeLessThan(SAMPLE_RATE * 1.6);
      expect(Buffer.from(a.buffer).equals(Buffer.from(b.buffer)), name).toBe(true);
      const peak = peakOf(a);
      expect(peak, name).toBeLessThanOrEqual(0.8001);
      expect(peak, name).toBeGreaterThan(0.5);
      expect(Math.abs(a[0] ?? 1), name).toBeLessThan(0.01); // faded edges
      expect(Math.abs(a[a.length - 1] ?? 1), name).toBeLessThan(0.01);
    }
  });

  it('the bite tick is shorter than the bite interval, so 14 ticks a second stay apart', () => {
    const bite = renderSfx('bite');
    expect(bite.length / SAMPLE_RATE).toBeLessThan(BITE_INTERVAL_MS / 1000);
    expect(1000 / BITE_INTERVAL_MS).toBeGreaterThan(14);
  });

  it('music loop is exactly 16 s, below the SFX peaks and loud enough for a phone speaker', () => {
    const m = renderMusic();
    expect(m.length).toBe(16 * SAMPLE_RATE);
    let sum = 0;
    for (const v of m) sum += v * v;
    // Peak 0.85 (Peek & Find docs/audio-review.md: the phone speaker lesson); played at 0.5.
    const peak = peakOf(m);
    expect(peak).toBeLessThanOrEqual(0.8501);
    expect(peak).toBeGreaterThan(0.8);
    expect(20 * Math.log10(Math.sqrt(sum / m.length))).toBeGreaterThan(-20);
  });

  it('writes a valid 16-bit mono WAV', () => {
    const wav = toWav(renderSfx('button'));
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(wav.subarray(8, 12).toString()).toBe('WAVE');
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(SAMPLE_RATE);
    expect(wav.readUInt32LE(40)).toBe(wav.length - 44);
  });
});

describe('committed audio (npm run audio)', () => {
  it('public/audio holds every sound in both formats within budget', () => {
    const indexPath = new URL('public/audio/index.json', ROOT);
    expect(existsSync(indexPath)).toBe(true);
    const index = JSON.parse(readFileSync(indexPath, 'utf8')) as {
      version: number;
      sounds: Record<string, { ogg: string; m4a: string; music: boolean }>;
      music: string;
    };
    expect(index.version).toBe(1);
    expect(index.music).toBe(manifest.music);
    expect(new Set(Object.keys(index.sounds))).toEqual(new Set([...manifest.sfx, manifest.music]));
    const total = { ogg: 0, m4a: 0 };
    for (const [key, e] of Object.entries(index.sounds)) {
      expect(e.music, key).toBe(key === manifest.music);
      for (const [fmt, f] of [
        ['ogg', e.ogg],
        ['m4a', e.m4a],
      ] as const) {
        expect(f).toBe(`audio/${key}.${fmt}`);
        const url = new URL(`public/${f}`, ROOT);
        expect(existsSync(url), f).toBe(true);
        const size = statSync(url).size;
        expect(size, f).toBeGreaterThan(200);
        total[fmt] += size;
        if (key === manifest.music) expect(size, f).toBeLessThanOrEqual(150 * 1024);
      }
    }
    expect(total.ogg).toBeLessThanOrEqual(1024 * 1024);
    expect(total.m4a).toBeLessThanOrEqual(1024 * 1024);
  });
});

/** Same list as scripts/audio.mjs: a drop-in source replaces the placeholder. */
const SOURCE_EXT = ['wav', 'ogg', 'mp3', 'flac', 'm4a', 'aac'];

function hasDropIn(name: string): boolean {
  return SOURCE_EXT.some((ext) => existsSync(new URL(`assets/audio/${name}.${ext}`, ROOT)));
}

/** Mean level (dBFS) of the shipped OGG with ffmpeg, or null when ffmpeg is missing. */
function measureShipped(name: string): number | null {
  const file = fileURLToPath(new URL(`public/audio/${name}.ogg`, ROOT));
  const r = spawnSync('ffmpeg', [
    '-hide_banner',
    '-i',
    file,
    '-af',
    'volumedetect',
    '-f',
    'null',
    '-',
  ]);
  if (r.error) return null;
  const m = /mean_volume: (-?[\d.]+) dB/.exec(r.stderr.toString());
  return m ? Number(m[1]) : null;
}

function measureSynth(name: string): number {
  const a = renderSfx(name);
  let sum = 0;
  for (const v of a) sum += v * v;
  return 10 * Math.log10(sum / a.length);
}

describe('feel sound levels (GDD §3a)', () => {
  it('SFX_FILE_DB matches the shipped files, so the success-over-failure test means something', () => {
    for (const sound of Object.keys(SFX_FILE_DB) as FeelSound[]) {
      const shipped = measureShipped(sound);
      if (shipped === null && hasDropIn(sound)) {
        throw new Error(`${sound} is a drop-in: install ffmpeg to measure it for SFX_FILE_DB`);
      }
      const measured = shipped ?? measureSynth(sound);
      const hint = `${sound}: measured ${measured.toFixed(1)} dB, SFX_FILE_DB.${sound} = ${String(SFX_FILE_DB[sound])}; update src/game/feel.ts`;
      expect(Math.abs(measured - SFX_FILE_DB[sound]), hint).toBeLessThanOrEqual(1);
    }
  });
});
