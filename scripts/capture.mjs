#!/usr/bin/env node
// Muted 10-second capture of level 20 (TASKS.md Epic 4 AC; brief M2: "a muted 10-second capture
// of level 20 looks like an ad"). Plays the stored solution of level 20 through real taps in the
// development build (dist/test, its __munchDebug hooks), each tap as soon as the previous cascade
// has drained, records the page at 540×960 (Playwright recordVideo: no sound track), keeps the
// last 10 s of the level with ffmpeg and writes a contact sheet (one frame per 0.5 s) with sharp:
//
//   docs/capture/level-20.webm        the clip (VP8, muted)
//   docs/capture/level-20-sheet.png   20 frames, 0.5 s apart
//
// It fails unless the clip's feel log holds a chain wake, at least three full meals and the win,
// and unless no 10 s of the level pass without a finish (GDD §3a micro-win cadence).
//
// Playwright's screencast lags the page under load and drops what is still queued when the page
// closes, so the page stays open well past the win, the win is found in the video itself (the
// first frame showing the win panel's button) and the clip ends CLIP_TAIL_S after it; the feel
// log maps onto the video through the same anchor (the win's wall time).
// Run with `npm run capture` (builds dist/test first). Needs ffmpeg (libvpx) on the PATH.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const LEVEL = 20;
const CLIP_S = 10;
/** The finish cadence the GDD asks for: never this long without a muncher finishing. */
const MAX_FINISH_GAP_MS = 10_000;
/** 9:16 at half the design size. */
const VIEW = { width: 540, height: 960 };
/** The page stays open this long after the win, so the lagging screencast delivers it. */
const HOLD_AFTER_WIN_MS = 6000;
/** The clip ends this long after the win: the blink, the grow and the confetti play out. */
const CLIP_TAIL_S = 1.5;
/** The win panel's button (src/config.ts COLOR_BUTTON, PANEL_BUTTON_R in design px). */
const BUTTON_RGB = [0xf7, 0xb3, 0x2b];
const BUTTON_TOLERANCE = 40;
const PANEL_R = 110;
/** The probe pixel sits inside the button, below its play mark (a share of its radius). */
const PROBE_SHARE = 0.7;
/** The video is scanned for the panel this far around the win's wall time (s), frame by frame. */
const SCAN_S = 6;
const VIDEO_FPS = 25;
const SHEET_FPS = 2;
const SHEET_COLS = 10;
const SHEET_CELL_W = 162;
const SHEET_LABEL_H = 18;
const PORT = 4175;
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = join(ROOT, 'docs', 'capture');
const CLIP = join(OUT, `level-${String(LEVEL)}.webm`);
const SHEET = join(OUT, `level-${String(LEVEL)}-sheet.png`);
const URL_PATH = `test/?reset=1&level=${String(LEVEL)}&renderer=canvas&fpsmin=1`;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.error) throw new Error(`${cmd} not found: install it to run npm run capture`);
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed:\n${String(r.stderr)}`);
  return r;
}

/** `vite preview` of dist on its own port; resolves once it serves. */
function startServer() {
  const p = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  const stop = () => {
    try {
      process.kill(-p.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  };
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      stop();
      reject(new Error('vite preview did not start'));
    }, 30_000);
    p.stdout.on('data', (d) => {
      if (String(d).includes(String(PORT))) {
        clearTimeout(timer);
        resolve({ url: `http://127.0.0.1:${String(PORT)}/`, stop });
      }
    });
    p.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`vite preview exited (${String(code)})`));
    });
  });
}

async function waitFor(page, pred, label, timeout = 30_000) {
  const t0 = Date.now();
  for (;;) {
    const s = await page.evaluate(() => window.__munchDebug?.state());
    if (s && pred(s)) return s;
    if (Date.now() - t0 > timeout) throw new Error(`capture: timeout waiting for ${label}`);
    await page.waitForTimeout(50);
  }
}

/** Plays the level; returns its feel log, where the win panel's button is and the raw video. */
async function record(url, dir) {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const context = await browser.newContext({ viewport: VIEW, recordVideo: { dir, size: VIEW } });
    const page = await context.newPage();
    await page.goto(url + URL_PATH, { waitUntil: 'load' });
    const s0 = await waitFor(page, (s) => s.game?.inputOpen === true, 'level 20');
    for (const lane of s0.game.solution) {
      const p = await page.evaluate((n) => window.__munchDebug?.point(n), `lane:${String(lane)}`);
      if (!p) throw new Error(`capture: lane ${String(lane)} not on screen`);
      await page.mouse.click(p.x, p.y);
      await waitFor(page, (s) => s.game?.pending === 0, 'the cascade drained');
    }
    await waitFor(page, (s) => s.game?.panel === 'win', 'the win');
    await page.waitForTimeout(HOLD_AFTER_WIN_MS);
    const end = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return {
        feel: window.__munchDebug?.state().game?.feel ?? [],
        button: window.__munchDebug?.point('next') ?? null,
        // CSS px per design px (the video has the viewport's size)
        scale: c ? c.getBoundingClientRect().width / c.width : 0,
      };
    });
    await context.close();
    const raw = readdirSync(dir).find((f) => f.endsWith('.webm'));
    if (!raw) throw new Error('capture: no video recorded');
    if (!end.button) throw new Error('capture: no win panel button');
    return { ...end, raw: join(dir, raw) };
  } finally {
    await browser.close();
  }
}

/** Video time (s) of the first frame where the probe pixel shows the win panel's button. */
function findWin(raw, probe, around) {
  const from = Math.max(0, around - SCAN_S);
  const crop = `crop=2:2:${String(probe.x)}:${String(probe.y)}`;
  const r = spawnSync(
    'ffmpeg',
    [
      ...['-hide_banner', '-loglevel', 'error', '-ss', from.toFixed(3), '-i', raw],
      ...['-t', String(2 * SCAN_S), '-vf', `fps=${String(VIDEO_FPS)},${crop}`],
      ...['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  if (r.status !== 0) throw new Error(`capture: ffmpeg scan failed: ${String(r.stderr)}`);
  const frame = 2 * 2 * 3;
  for (let i = 0; (i + 1) * frame <= r.stdout.length; i++) {
    const px = r.stdout.subarray(i * frame, i * frame + 3);
    if (BUTTON_RGB.every((c, k) => Math.abs(c - (px[k] ?? 0)) <= BUTTON_TOLERANCE)) {
      return from + i / VIDEO_FPS;
    }
  }
  throw new Error('capture: the win panel never shows in the video');
}

/** The longest stretch without a finish (a full meal or the win) between `from` and `to`. */
function longestWithoutFinish(feel, from, to) {
  const finishes = feel
    .filter((e) => e.kind === 'full' || e.kind === 'win')
    .map((e) => e.wall)
    .filter((w) => w >= from && w <= to);
  let worst = 0;
  let last = from;
  for (const w of [...finishes, to]) {
    worst = Math.max(worst, w - last);
    last = w;
  }
  return worst;
}

async function contactSheet(clip, dir) {
  const frames = join(dir, 'frames');
  mkdirSync(frames, { recursive: true });
  run('ffmpeg', [
    ...['-hide_banner', '-loglevel', 'error', '-i', clip],
    ...['-vf', `fps=${String(SHEET_FPS)}`, join(frames, 'f-%02d.png')],
  ]);
  const files = readdirSync(frames)
    .filter((f) => f.endsWith('.png'))
    .sort();
  const cellH = Math.round((SHEET_CELL_W * VIEW.height) / VIEW.width);
  const rows = Math.ceil(files.length / SHEET_COLS);
  const comps = [];
  for (let i = 0; i < files.length; i++) {
    const img = await sharp(join(frames, files[i])).resize({ width: SHEET_CELL_W }).toBuffer();
    const left = (i % SHEET_COLS) * SHEET_CELL_W;
    const top = Math.floor(i / SHEET_COLS) * (cellH + SHEET_LABEL_H);
    const t = (i / SHEET_FPS).toFixed(1);
    const svg =
      `<svg width="${String(SHEET_CELL_W)}" height="${String(SHEET_LABEL_H)}">` +
      `<rect width="100%" height="100%" fill="#1b1f2a"/><text x="4" y="13" ` +
      `font-family="sans-serif" font-size="12" fill="#d8dce8">${t} s</text></svg>`;
    comps.push(
      { input: Buffer.from(svg), left, top },
      { input: img, left, top: top + SHEET_LABEL_H },
    );
  }
  await sharp({
    create: {
      width: SHEET_COLS * SHEET_CELL_W,
      height: rows * (cellH + SHEET_LABEL_H),
      channels: 3,
      background: '#1b1f2a',
    },
  })
    .composite(comps)
    .png({ compressionLevel: 9, palette: true })
    .toFile(SHEET);
  return files.length;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), 'munch-capture-'));
  const server = await startServer();
  try {
    const { feel, raw, button, scale } = await record(server.url, dir);
    const level = feel.filter((e) => e.level === LEVEL);
    const win = level.find((e) => e.kind === 'win');
    if (!win) throw new Error('capture: no win in the feel log');
    const start = Math.min(...level.map((e) => e.wall));
    // the anchor: the first video frame with the win panel (a pixel in its button)
    const probe = {
      x: Math.round(button.x),
      y: Math.round(button.y + PROBE_SHARE * PANEL_R * scale),
    };
    const vWin = findWin(raw, probe, win.wall / 1000);
    const clipStart = vWin + CLIP_TAIL_S - CLIP_S;
    const clipTo = win.wall + CLIP_TAIL_S * 1000;
    const clipFrom = clipTo - CLIP_S * 1000;
    const inClip = level.filter((e) => e.wall >= clipFrom && e.wall <= clipTo);
    const count = (k) => inClip.filter((e) => e.kind === k).length;
    const hops = level.filter((e) => e.kind === 'hop');
    const firstTap = hops.filter((e) => e.wall < clipFrom).length + 1;
    const whole = longestWithoutFinish(level, start, win.wall);
    const inside = longestWithoutFinish(level, clipFrom, clipTo);
    // 10 s ending CLIP_TAIL_S after the win, muted, small: VP8 at a constant quality
    run('ffmpeg', [
      ...['-hide_banner', '-loglevel', 'error', '-y', '-ss', clipStart.toFixed(3), '-i', raw],
      ...['-t', String(CLIP_S), '-an', '-c:v', 'libvpx', '-crf', '24', '-b:v', '700k'],
      ...['-deadline', 'good', '-cpu-used', '2', '-map_metadata', '-1', CLIP],
    ]);
    const info = JSON.parse(
      run('ffprobe', [
        ...['-v', 'error', '-show_entries', 'stream=codec_type:format=duration'],
        ...['-of', 'json', CLIP],
      ]).stdout,
    );
    const duration = Number(info.format?.duration ?? 0);
    const audio = (info.streams ?? []).filter((s) => s.codec_type === 'audio').length;
    const frames = await contactSheet(CLIP, dir);
    const kb = (f) => `${String(Math.round(statSync(f).size / 1024))} KB`;
    const s1 = (ms) => `${(ms / 1000).toFixed(1)} s`;
    console.log(`capture: ${CLIP} (${duration.toFixed(1)} s, ${kb(CLIP)}, ${String(audio)} audio)`);
    console.log(`capture: ${SHEET} (${String(frames)} frames, ${kb(SHEET)})`);
    console.log(
      `capture: the clip holds taps ${String(firstTap)}–${String(hops.length)} of ` +
        `${String(hops.length)}: ${String(count('hop'))} hops, ${String(count('bite'))} bites, ` +
        `${String(count('wake'))} wakes, ${String(count('full'))} full meals, ` +
        `${String(count('win'))} win; the win at ${(vWin - clipStart).toFixed(1)} s of the clip`,
    );
    console.log(
      `capture: longest stretch without a finish: ${s1(whole)} over the level, ` +
        `${s1(inside)} in the clip`,
    );
    const problems = [];
    if (count('wake') < 1) problems.push('no chain wake in the clip');
    if (count('full') < 3) problems.push(`only ${String(count('full'))} full meals in the clip`);
    if (count('win') !== 1) problems.push('no win in the clip');
    if (whole >= MAX_FINISH_GAP_MS) problems.push('10 s without a finish in the level');
    if (inside >= MAX_FINISH_GAP_MS) problems.push('10 s without a finish in the clip');
    if (audio !== 0) problems.push('the clip has a sound track');
    if (Math.abs(duration - CLIP_S) > 0.5) problems.push(`the clip is ${duration.toFixed(1)} s`);
    for (const p of problems) console.error(`capture: FAIL: ${p}`);
    if (problems.length > 0) process.exitCode = 1;
  } finally {
    server.stop();
    if (process.env.CAPTURE_KEEP) console.log(`capture: kept ${dir}`);
    else rmSync(dir, { recursive: true, force: true });
  }
}

await main();
