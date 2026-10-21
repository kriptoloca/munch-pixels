import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COLOR_MUNCHER_RING, DIGIT_MIN_PX } from '../src/config';
import { COLOR_BOARD, PALETTE } from '../src/data/palette';
import { computeLayout, designSize } from '../src/game/layout';
import {
  BELLY,
  BODY,
  DIGIT_FRONT,
  DIGIT_QUEUE,
  chipFontPx,
  EXPRESSIONS,
  EYE,
  FEATURE,
  LID_FILL,
  OUTLINE,
  faceToneFor,
  luminance,
  muncherBody,
  muncherFace,
  pupilOffset,
  type Expression,
  type Prim,
} from '../src/game/muncher-art';
import { bodyKey, faceKey } from '../src/game/textures';
import { deltaE } from './colour';

/** Bounding box of a shape in unit coordinates, strokes included. */
function bounds(p: Prim): { x0: number; y0: number; x1: number; y1: number } {
  const w = (p.width ?? 0) / 2;
  if (p.kind === 'ellipse') {
    const r = Math.max(p.rx, p.ry); // a rotated ellipse stays inside its larger radius
    const rx = p.rot ? r : p.rx;
    const ry = p.rot ? r : p.ry;
    return { x0: p.cx - rx - w, y0: p.cy - ry - w, x1: p.cx + rx + w, y1: p.cy + ry + w };
  }
  const xs: number[] = [];
  const ys: number[] = [];
  for (const c of p.d) {
    if (c[0] === 'M' || c[0] === 'L') {
      xs.push(c[1]);
      ys.push(c[2]);
    }
    if (c[0] === 'Q') {
      xs.push(c[1], c[3]);
      ys.push(c[2], c[4]);
    }
  }
  return {
    x0: Math.min(...xs) - w,
    y0: Math.min(...ys) - w,
    x1: Math.max(...xs) + w,
    y1: Math.max(...ys) + w,
  };
}

const KEYS = Object.keys(PALETTE);
const colour = (k: string): number => PALETTE[k] as number;

describe('muncher art (GDD §4; pure geometry, src/game/muncher-art.ts)', () => {
  it('one body per palette colour, filled with exactly that colour (no tint)', () => {
    expect(new Set(KEYS.map(bodyKey)).size).toBe(KEYS.length);
    for (const k of KEYS) {
      const body = muncherBody(colour(k), COLOR_MUNCHER_RING);
      const own = body.filter((p) => p.kind === 'ellipse' && p.fill === colour(k));
      expect(own, k).toHaveLength(1);
      const e = own[0] as Prim & { kind: 'ellipse' };
      // the body's own colour covers most of the body
      expect((e.rx * e.ry) / (BODY.rx * BODY.ry), k).toBeGreaterThan(0.8);
    }
  });

  it('the ink body keeps its light ring; every other body has a darker outline of its colour', () => {
    for (const k of KEYS) {
      const body = muncherBody(colour(k), COLOR_MUNCHER_RING);
      const outline = body.find(
        (p) => p.kind === 'ellipse' && Math.abs(p.rx - (BODY.rx + OUTLINE)) < 1e-9,
      );
      expect(outline, k).toBeDefined();
      if (k === 'd') {
        expect(outline?.fill).toBe(COLOR_MUNCHER_RING);
        expect(faceToneFor(colour(k))).toBe('dark');
      } else {
        expect(luminance(outline?.fill ?? 0), k).toBeLessThan(luminance(colour(k)));
        expect(faceToneFor(colour(k)), k).toBe('light');
      }
    }
    // the light ring reads on the board and the page
    expect(deltaE(COLOR_MUNCHER_RING, COLOR_BOARD)).toBeGreaterThan(40);
  });

  it('every shape stays inside the texture box', () => {
    const all: [string, Prim[]][] = [
      ...KEYS.map((k): [string, Prim[]] => [k, muncherBody(colour(k), COLOR_MUNCHER_RING)]),
      ...EXPRESSIONS.flatMap((e): [string, Prim[]][] => [
        [`${e} light`, muncherFace(e, 'light')],
        [`${e} dark`, muncherFace(e, 'dark')],
      ]),
    ];
    for (const [name, prims] of all) {
      for (const p of prims) {
        const b = bounds(p);
        expect(b.x0, name).toBeGreaterThanOrEqual(-0.5);
        expect(b.y0, name).toBeGreaterThanOrEqual(-0.5);
        expect(b.x1, name).toBeLessThanOrEqual(0.5);
        expect(b.y1, name).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('expressions: waiting looks up, stuck looks down, waking opens wide, full is smug', () => {
    expect(pupilOffset('waiting').y).toBeLessThan(0);
    expect(pupilOffset('stuck').y).toBeGreaterThan(0);
    const eyeArea = (e: Expression): number =>
      muncherFace(e, 'light')
        .filter((p) => p.kind === 'ellipse' && p.fill === FEATURE.white && p.cy === EYE.cy)
        .reduce((a, p) => a + (p.kind === 'ellipse' ? p.rx * p.ry : 0), 0);
    expect(eyeArea('waking')).toBeGreaterThan(eyeArea('idle'));
    const lids = (e: Expression): number =>
      muncherFace(e, 'light').filter((p) => p.fill === LID_FILL).length;
    expect(lids('full')).toBe(2);
    expect(lids('waiting')).toBe(0);
    expect(lids('waking')).toBe(0);
    const mouthArea = (e: Expression): number =>
      muncherFace(e, 'light')
        .filter((p) => p.kind === 'ellipse' && p.fill === FEATURE.mouth)
        .reduce((a, p) => a + (p.kind === 'ellipse' ? p.rx * p.ry : 0), 0);
    // the eating mouth is the widest, the waiting one is open, the waking one a small "o"
    expect(mouthArea('eating')).toBeGreaterThan(mouthArea('waiting'));
    expect(mouthArea('waiting')).toBeGreaterThan(mouthArea('waking'));
    expect(mouthArea('waking')).toBeGreaterThan(0);
    // every expression differs from every other one
    const sigs = EXPRESSIONS.map((e) => JSON.stringify(muncherFace(e, 'light')));
    expect(new Set(sigs).size).toBe(EXPRESSIONS.length);
    expect(new Set(EXPRESSIONS.map((e) => faceKey(e, 'light'))).size).toBe(EXPRESSIONS.length);
  });

  it('the face never covers the appetite digit', () => {
    // Digit box: two digits at most (appetite ≤ 11), cap height 0.72 em, width 1.2 em.
    const box = (d: { cy: number; size: number }): { y0: number; y1: number; half: number } => ({
      y0: d.cy - 0.36 * d.size,
      y1: d.cy + 0.36 * d.size,
      half: 0.6 * d.size,
    });
    for (const [expr, d] of [
      ...EXPRESSIONS.filter((e) => e !== 'queue').map((e): [Expression, typeof DIGIT_FRONT] => [
        e,
        DIGIT_FRONT,
      ]),
      ['queue', DIGIT_QUEUE] as [Expression, typeof DIGIT_QUEUE],
    ]) {
      const b = box(d);
      for (const tone of ['light', 'dark'] as const) {
        for (const p of muncherFace(expr, tone)) {
          const f = bounds(p);
          const overlaps = f.y1 > b.y0 && f.y0 < b.y1 && f.x1 > -b.half && f.x0 < b.half;
          expect(overlaps, `${expr} ${tone}: ${JSON.stringify(p)}`).toBe(false);
        }
      }
    }
    // the front digit sits on the belly
    expect(DIGIT_FRONT.cy).toBeCloseTo(BELLY.cy, 6);
  });

  it('features read on every body (brows and mouths; ΔE ≥ 25)', () => {
    for (const k of KEYS) {
      const c = colour(k);
      const tone = faceToneFor(c);
      for (const e of EXPRESSIONS) {
        for (const p of muncherFace(e, tone)) {
          if (p.kind !== 'path' || p.stroke === undefined) continue;
          expect(deltaE(p.stroke, c), `${k} ${e}`).toBeGreaterThanOrEqual(25);
        }
      }
      // eye whites carry an ink ring, so they read even on the cream body
      const eyes = muncherFace('idle', tone).filter((p) => p.fill === FEATURE.white);
      expect(eyes.some((p) => p.stroke === FEATURE.ink)).toBe(true);
    }
  });

  it('the appetite digit is legible on every screen, the queue munchers included', () => {
    const sizes: [number, number][] = [];
    for (const [vw, vh] of [
      [390, 693],
      [360, 800],
      [800, 800],
      [1280, 720],
    ] as const) {
      const s = designSize(vw, vh);
      sizes.push([s.width, s.height]);
    }
    for (const [w, h] of sizes) {
      for (const lanes of [2, 3, 4, 5]) {
        const l = computeLayout(w, h, { cols: 16, rows: 15, slots: 5, lanes });
        const front = DIGIT_FRONT.size * l.muncherSize;
        const queue = DIGIT_QUEUE.size * l.miniSize;
        expect(front, `${String(w)}×${String(h)} front`).toBeGreaterThanOrEqual(DIGIT_MIN_PX);
        expect(queue, `${String(w)}×${String(h)} queue`).toBeGreaterThanOrEqual(DIGIT_MIN_PX);
      }
    }
  });

  it('the "+N" chip reads larger than the queue digits it stands for, never under the floor', () => {
    for (const [vw, vh] of [
      [390, 693],
      [360, 800],
      [768, 1024],
      [800, 800],
      [1280, 720],
    ] as const) {
      const { width, height } = designSize(vw, vh);
      for (const lanes of [2, 3, 4, 5]) {
        const l = computeLayout(width, height, { cols: 16, rows: 15, slots: 5, lanes });
        const tag = `${String(width)}×${String(height)} l${String(lanes)}`;
        const chip = chipFontPx(l.miniSize);
        expect(chip, tag).toBeGreaterThan(DIGIT_QUEUE.size * l.miniSize);
        expect(chip, tag).toBeGreaterThanOrEqual(DIGIT_MIN_PX);
        // it still fits its place: no taller than a queued muncher
        expect(chip, tag).toBeLessThanOrEqual(l.miniSize);
      }
    }
  });
});

describe('rendering rule (CLAUDE.md "Rendering")', () => {
  it('no game code tints a colour the player must tell apart (setTint is never called)', () => {
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.ts')) files.push(p);
      }
    };
    walk(new URL('../src/', import.meta.url).pathname);
    for (const f of files) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/\.setTint\(/);
    }
  });
});
