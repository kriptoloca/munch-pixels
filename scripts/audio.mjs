#!/usr/bin/env node
// Audio pipeline (GDD §11, ported from Peek & Find): sources under assets/audio/ → mono OGG
// (Vorbis) + M4A (AAC, Safari) under public/audio/, plus public/audio/index.json for the game's
// loader. A missing source is synthesized (scripts/lib/synth.mjs), so every sound exists from day
// one (D14: the placeholders ship to the sandbox; real files drop into assets/audio/ later).
//
//   node scripts/audio.mjs           encode everything (needs ffmpeg with libvorbis + aac)
//   node scripts/audio.mjs --check   check the committed output against the manifest, the
//                                    budgets and the sources' durations (needs ffprobe; CI
//                                    installs ffmpeg and runs this)
//
// Encoding is deterministic for one ffmpeg build (bitexact flags, no metadata) but not across
// ffmpeg versions, so CI checks presence, budgets and durations, not bytes; tests/audio.test.ts
// measures the shipped levels against SFX_FILE_DB (src/game/feel.ts). ffmpeg reads every source
// by path (scripts/lib/encode.mjs): the placeholders go through a temporary WAV.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { durationMatches, encodeAudio, probeDuration } from './lib/encode.mjs';
import { MUSIC_NAME, SAMPLE_RATE, SFX_NAMES, renderMusic, renderSfx, toWav } from './lib/synth.mjs';

const ROOT = new URL('../', import.meta.url);
const SRC = new URL('assets/audio/', ROOT);
const OUT = new URL('public/audio/', ROOT);
const SOURCE_EXT = ['wav', 'ogg', 'mp3', 'flac', 'm4a', 'aac'];
/** Budgets (Peek & Find ASSETS.md): music loop ≤ 150 KB, all audio ≤ 1 MB, per format. */
const MUSIC_BUDGET = 150 * 1024;
const TOTAL_BUDGET = 1024 * 1024;
/** A file this small is an empty or broken encode. */
const MIN_FILE = 200;
const FORMATS = ['ogg', 'm4a'];

const CHECK = process.argv.includes('--check');
const p = (url) => fileURLToPath(url);

const manifest = JSON.parse(readFileSync(new URL('src/data/audio-manifest.json', ROOT), 'utf8'));
if (JSON.stringify(manifest.sfx) !== JSON.stringify(SFX_NAMES) || manifest.music !== MUSIC_NAME) {
  throw new Error('src/data/audio-manifest.json and scripts/lib/synth.mjs disagree');
}
const NAMES = [...SFX_NAMES, MUSIC_NAME];

function sourceFor(name) {
  for (const ext of SOURCE_EXT) {
    const url = new URL(`${name}.${ext}`, SRC);
    if (existsSync(url)) return url;
  }
  return null;
}

/** A placeholder's samples (scripts/lib/synth.mjs). */
function synth(name) {
  return name === MUSIC_NAME ? renderMusic() : renderSfx(name);
}

/** How long a sound's source runs, in seconds (its file by ffprobe, or the placeholder). */
function sourceDuration(name) {
  const src = sourceFor(name);
  return src ? probeDuration(p(src)) : synth(name).length / SAMPLE_RATE;
}

const pad = (s, n) => String(s).padEnd(n);
const kb = (n) => `${String(Math.round(n / 1024))} KB`;

function report(rows) {
  console.log(pad('name', 14) + pad('source', 13) + pad('ogg', 9) + pad('m4a', 9));
  for (const r of rows) {
    console.log(pad(r.name, 14) + pad(r.source, 13) + pad(kb(r.ogg), 9) + pad(kb(r.m4a), 9));
  }
  const total = (fmt) => rows.reduce((s, r) => s + r[fmt], 0);
  const placeholders = rows.filter((r) => r.source === 'placeholder').length;
  console.log(
    `total ogg ${kb(total('ogg'))} · m4a ${kb(total('m4a'))} · ${String(placeholders)} placeholder(s)`,
  );
  const problems = [];
  const music = rows.find((r) => r.name === MUSIC_NAME);
  if (music && (music.ogg > MUSIC_BUDGET || music.m4a > MUSIC_BUDGET)) {
    problems.push('music loop over 150 KB');
  }
  for (const fmt of FORMATS) {
    if (total(fmt) > TOTAL_BUDGET) problems.push(`${fmt} audio over 1 MB`);
  }
  return problems;
}

function encode() {
  mkdirSync(p(OUT), { recursive: true });
  const index = { version: 1, sounds: {}, music: MUSIC_NAME };
  const rows = [];
  const temp = mkdtempSync(join(tmpdir(), 'munch-audio-'));
  try {
    for (const name of NAMES) rows.push(encodeOne(name, temp, index));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  writeFileSync(p(new URL('index.json', OUT)), `${JSON.stringify(index, null, 2)}\n`);
  console.log('audio encoded into public/audio/:');
  return report(rows);
}

/** Encodes one sound in both formats and lists it in the index; returns its report row. */
function encodeOne(name, temp, index) {
  const src = sourceFor(name);
  const isMusic = name === MUSIC_NAME;
  const input = src ? p(src) : join(temp, `${name}.wav`);
  if (!src) writeFileSync(input, toWav(synth(name)));
  const ogg = encodeAudio(input, p(new URL(`${name}.ogg`, OUT)), [
    '-c:a',
    'libvorbis',
    '-q:a',
    isMusic ? '0' : '3',
  ]);
  const m4a = encodeAudio(input, p(new URL(`${name}.m4a`, OUT)), [
    '-c:a',
    'aac',
    '-b:a',
    isMusic ? '64k' : '48k',
    '-movflags',
    '+faststart',
  ]);
  const source = src ? 'file' : 'placeholder';
  index.sounds[name] = {
    ogg: `audio/${name}.ogg`,
    m4a: `audio/${name}.m4a`,
    source,
    music: isMusic,
  };
  return { name, source, ogg, m4a };
}

/**
 * CI: the committed files match the manifest, exist in both formats, keep the budgets and run as
 * long as their sources (an empty or cut encode passes every size check, so the length is
 * checked too, by ffprobe).
 */
function check() {
  const problems = [];
  const indexUrl = new URL('index.json', OUT);
  if (!existsSync(indexUrl)) return ['public/audio/index.json is missing: run npm run audio'];
  const index = JSON.parse(readFileSync(indexUrl, 'utf8'));
  if (index.version !== 1 || index.music !== MUSIC_NAME) problems.push('index.json: bad header');
  const listed = Object.keys(index.sounds ?? {}).sort();
  if (JSON.stringify(listed) !== JSON.stringify([...NAMES].sort())) {
    problems.push(`index.json lists ${listed.join(', ')}; the manifest ${NAMES.join(', ')}`);
  }
  const rows = [];
  for (const name of NAMES) {
    const e = index.sounds?.[name];
    const row = { name, source: e?.source ?? 'missing', ogg: 0, m4a: 0 };
    rows.push(row);
    const expectedSource = sourceFor(name) ? 'file' : 'placeholder';
    if (e && e.source !== expectedSource) {
      problems.push(`${name}: index says ${String(e.source)}, assets/audio says ${expectedSource}`);
    }
    const length = sourceDuration(name);
    for (const fmt of FORMATS) {
      const rel = `audio/${name}.${fmt}`;
      if (e?.[fmt] !== rel) problems.push(`${name}: index entry for ${fmt} is not ${rel}`);
      const url = new URL(`${name}.${fmt}`, OUT);
      if (!existsSync(url)) {
        problems.push(`public/${rel} is missing`);
        continue;
      }
      row[fmt] = statSync(url).size;
      if (row[fmt] < MIN_FILE) problems.push(`public/${rel} is too small (${String(row[fmt])} B)`);
      const encoded = probeDuration(p(url));
      if (!durationMatches(length, encoded)) {
        problems.push(
          `public/${rel} runs ${String(encoded)} s, its source ${String(length)} s: run npm run audio`,
        );
      }
    }
  }
  console.log('audio committed in public/audio/:');
  return [...problems, ...report(rows)];
}

try {
  const problems = CHECK ? check() : encode();
  for (const w of problems) console.error(`  problem: ${w}`);
  if (problems.length > 0) process.exit(1);
  if (CHECK) console.log('audio:check OK');
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
