import { describe, expect, it } from 'vitest';
import { PALETTE } from '../src/data/palette';
import {
  FACE_BACKGROUNDS,
  FACE_CHEEK,
  FACE_DARK,
  FACE_HEADS,
  FACE_TONGUE,
  FACE_WHITE,
  drawFace,
  faceParts,
} from '../src/gen/face';
import { deltaE, lab } from './colour';

const hex = (c: number): string => c.toString(16).padStart(6, '0');

describe('hidden faces (GENERATOR.md §7)', () => {
  it('are deterministic and fill the whole grid', () => {
    expect(drawFace(9, 14, 13)).toEqual(drawFace(9, 14, 13));
    const f = drawFace(123, 16, 15);
    expect(f.px).toHaveLength(16 * 15);
    expect(f.px.every((c) => Number.isInteger(c) && c >= 0)).toBe(true);
  });

  it('every face has a head and eyes that read against it, on small and large grids', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const [w, h] of [
        [8, 7],
        [10, 9],
        [16, 15],
        [20, 12],
      ] as const) {
        const f = drawFace(seed, w, h);
        expect(f.px.filter((c) => c === f.parts.head).length).toBeGreaterThan((w * h) / 4);
        const features = f.px.filter((c) => c === FACE_DARK || c === FACE_WHITE).length;
        expect(features, `seed ${String(seed)} ${String(w)}×${String(h)}`).toBeGreaterThanOrEqual(
          2,
        );
      }
    }
  });

  it('draws from the deep backgrounds and mid-tone heads only (no nursery pastels)', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const p = faceParts(seed);
      expect(FACE_BACKGROUNDS).toContain(p.background);
      expect(FACE_HEADS).toContain(p.head);
      seen.add(p.head);
    }
    expect(seen.size).toBe(FACE_HEADS.length);
    for (const c of FACE_BACKGROUNDS) expect(lab(c)[0], hex(c)).toBeLessThan(45);
    for (const c of FACE_HEADS) expect(lab(c)[0], hex(c)).toBeLessThan(75);
  });

  it('a revealed face cell never looks like a pixel to eat (ΔE ≥ 18 to every snack colour)', () => {
    const face = [
      ...FACE_BACKGROUNDS,
      ...FACE_HEADS,
      FACE_DARK,
      FACE_WHITE,
      FACE_TONGUE,
      FACE_CHEEK,
    ];
    for (const f of face) {
      for (const [k, c] of Object.entries(PALETTE)) {
        expect(deltaE(f, c), `${hex(f)} vs ${k}`).toBeGreaterThanOrEqual(18);
      }
    }
  });

  it('the face reads against itself: head on background, features and cheeks on the head', () => {
    for (const h of FACE_HEADS) {
      for (const b of FACE_BACKGROUNDS)
        expect(deltaE(h, b), `${hex(h)}/${hex(b)}`).toBeGreaterThan(20);
      expect(deltaE(FACE_DARK, h), hex(h)).toBeGreaterThan(30);
      expect(deltaE(FACE_WHITE, h), hex(h)).toBeGreaterThan(20);
      expect(deltaE(FACE_CHEEK, h), hex(h)).toBeGreaterThan(15);
    }
    expect(deltaE(FACE_TONGUE, FACE_DARK)).toBeGreaterThan(20);
  });
});
