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

/** FNV-1a over every px of the faces of seeds 0–299 on five grids (the faces before D6). */
function fingerprint(draw: (seed: number, w: number, h: number) => number[]): string {
  let h = 0x811c9dc5;
  for (let seed = 0; seed < 300; seed++) {
    for (const [w, hh] of [
      [8, 7],
      [10, 9],
      [16, 15],
      [20, 12],
      [18, 17],
    ] as const) {
      for (const c of draw(seed, w, hh)) {
        for (let k = 0; k < 4; k++) {
          h ^= (c >>> (8 * k)) & 255;
          h = Math.imul(h, 0x01000193) >>> 0;
        }
      }
    }
  }
  return h.toString(16);
}

describe('the win face (D6: a blink, then the grin)', () => {
  it('the blink touches only the eye cells, the smile only the mouth; the default face is unchanged', () => {
    // the faces players met in Epic 3, measured before the blink and the grin existed
    expect(fingerprint((s, w, h) => drawFace(s, w, h).px)).toBe('409a9f4');
    expect(fingerprint((s, w, h) => drawFace(s, w, h, {}).px)).toBe('409a9f4');
    let blinked = 0;
    let smiled = 0;
    for (let seed = 0; seed < 300; seed++) {
      for (const [w, h] of [
        [8, 7],
        [16, 15],
        [20, 12],
        [18, 17],
      ] as const) {
        const base = drawFace(seed, w, h);
        const blink = drawFace(seed, w, h, { eyesClosed: true });
        const smile = drawFace(seed, w, h, { mouth: 'grin' });
        const eyes = new Set([...base.eyeCells, ...blink.eyeCells]);
        const mouth = new Set([...base.mouthCells, ...smile.mouthCells]);
        let eyeDiff = 0;
        base.px.forEach((c, i) => {
          if (blink.px[i] !== c) {
            expect(eyes.has(i), `seed ${String(seed)} blink cell ${String(i)}`).toBe(true);
            eyeDiff += 1;
          }
          if (smile.px[i] !== c) {
            expect(mouth.has(i), `seed ${String(seed)} smile cell ${String(i)}`).toBe(true);
          }
        });
        if (eyeDiff > 0) blinked += 1;
        if (base.parts.mouth !== 'grin' && smile.px.some((c, i) => c !== base.px[i])) smiled += 1;
        expect(smile.parts.mouth).toBe('grin');
        // the same creature: every other part is the seed's own
        expect({ ...smile.parts, mouth: base.parts.mouth }).toEqual(base.parts);
      }
    }
    // the blink shows on (nearly) every face; every face without a grin gets one
    expect(blinked).toBeGreaterThan(0.85 * 300 * 4);
    expect(smiled).toBeGreaterThan(0.6 * 300 * 4);
  });

  it('every eye with whites shuts to a lid as wide as the eye, on odd and even grids', () => {
    let lids = 0;
    let cyclops = 0;
    for (let seed = 0; seed < 300; seed++) {
      for (const [w, h] of [
        [12, 10],
        [13, 11],
        [15, 14],
        [16, 15],
        [17, 16],
        [18, 17],
        [19, 12],
        [20, 12],
      ] as const) {
        const base = drawFace(seed, w, h);
        const blink = drawFace(seed, w, h, { eyesClosed: true });
        for (const eye of eyesOf(base)) {
          if (!eye.some((i) => base.px[i] === FACE_WHITE)) continue;
          const tag = `seed ${String(seed)} ${String(w)}×${String(h)} ${base.parts.eyes}`;
          // the lid lies on the pupil's row, from the eye's left edge to its right edge
          const pupil = eye.find((i) => base.px[i] === FACE_DARK) as number;
          const row = Math.floor(pupil / w);
          const xs = eye.map((i) => i % w);
          for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
            expect(blink.px[row * w + x], `${tag} lid x ${String(x)}`).toBe(FACE_DARK);
          }
          for (const i of eye) {
            if (Math.floor(i / w) !== row)
              expect(blink.px[i], `${tag} cell ${String(i)}`).toBe(base.parts.head);
          }
          lids += 1;
          if (base.parts.eyes === 'cyclops') cyclops += 1;
        }
      }
    }
    expect(lids).toBeGreaterThan(300);
    expect(cyclops).toBeGreaterThan(100);
  });
});

/** The eyes of a face as drawn: 4-connected groups of its eye cells showing white or dark. */
function eyesOf(f: ReturnType<typeof drawFace>): number[][] {
  const left = new Set(f.eyeCells.filter((i) => f.px[i] === FACE_WHITE || f.px[i] === FACE_DARK));
  const out: number[][] = [];
  for (const start of [...left]) {
    if (!left.has(start)) continue;
    left.delete(start);
    const eye = [start];
    for (let k = 0; k < eye.length; k++) {
      const i = eye[k] as number;
      const x = i % f.w;
      const near = [i - f.w, i + f.w, x > 0 ? i - 1 : -1, x < f.w - 1 ? i + 1 : -1];
      for (const j of near) {
        if (left.delete(j)) eye.push(j);
      }
    }
    out.push(eye);
  }
  return out;
}
