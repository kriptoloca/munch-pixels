import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { durationMatches, encodeAudio, probeDuration } from '../scripts/lib/encode.mjs';

/**
 * The audio pipeline with real ffmpeg (scripts/audio.mjs; CI installs ffmpeg). A drop-in source
 * must encode whole or fail loudly: an MP4/M4A with its index at the end used to come out as a
 * silent stub through a pipe, with ffmpeg reporting success (Epic 4 audit).
 */
const HAS_FFMPEG = spawnSync('ffmpeg', ['-version']).error === undefined;
const VORBIS = ['-c:a', 'libvorbis', '-q:a', '3'];
const SECONDS = 16;
const dir = mkdtempSync(join(tmpdir(), 'munch-audio-'));

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** A 16 s AAC tone in an M4A; `faststart` puts the index (moov) first, otherwise it is last. */
function tone(name: string, faststart: boolean): string {
  const path = join(dir, name);
  const r = spawnSync('ffmpeg', [
    ...['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi'],
    ...['-i', `sine=frequency=440:duration=${String(SECONDS)}`, '-ac', '1', '-ar', '44100'],
    ...['-c:a', 'aac', '-b:a', '64k', ...(faststart ? ['-movflags', '+faststart'] : []), path],
  ]);
  expect(r.status, r.stderr.toString()).toBe(0);
  return path;
}

/** Top-level MP4 atoms in file order. */
function atoms(path: string): string[] {
  const data = readFileSync(path);
  const out: string[] = [];
  for (let i = 0; i + 8 <= data.length;) {
    const size = data.readUInt32BE(i);
    out.push(data.toString('latin1', i + 4, i + 8));
    if (size < 8) break;
    i += size;
  }
  return out;
}

describe.skipIf(!HAS_FFMPEG)('audio encoding (scripts/lib/encode.mjs)', () => {
  it('a drop-in M4A with its index at the end encodes whole', () => {
    const src = tone('moov-last.m4a', false);
    const kinds = atoms(src);
    expect(kinds.indexOf('moov')).toBeGreaterThan(kinds.indexOf('mdat'));
    const out = join(dir, 'moov-last.ogg');
    encodeAudio(src, out, VORBIS);
    const length = probeDuration(out);
    expect(length).not.toBeNull();
    expect(length as number).toBeGreaterThan(SECONDS - 0.1);
    expect(durationMatches(probeDuration(src), length)).toBe(true);
  });

  it('a broken source fails the encode instead of writing a short file', () => {
    const whole = readFileSync(tone('whole.m4a', true));
    const cut = join(dir, 'cut.m4a');
    writeFileSync(cut, whole.subarray(0, Math.floor(whole.length * 0.6)));
    expect(() => encodeAudio(cut, join(dir, 'cut.ogg'), VORBIS)).toThrow(/ffmpeg failed/);
  });
});

describe('the duration check of npm run audio:check', () => {
  it('an output matches its source only at its length: not empty, not cut, not padded', () => {
    expect(durationMatches(0.92, 0.92)).toBe(true);
    expect(durationMatches(16, 16.02)).toBe(true);
    expect(durationMatches(0.045, 0.045)).toBe(true);
    expect(durationMatches(0.045, 0)).toBe(false);
    expect(durationMatches(0.045, null)).toBe(false);
    expect(durationMatches(16, 9.38)).toBe(false);
    expect(durationMatches(1.5, 2)).toBe(false);
    expect(durationMatches(null, 1)).toBe(false);
  });
});
