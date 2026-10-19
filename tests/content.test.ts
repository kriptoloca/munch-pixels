import { describe, expect, it } from 'vitest';
import { parsePicture, pixelsLeft } from '../src/core/board';
import { MAX_COLOURS, PALETTE, colourOf } from '../src/data/palette';
import { SNACKS, snackById } from '../src/data/snacks';
import { mirror, outline, snackForLevel } from '../src/gen/build-levels';
import { MAX_SIDE, MIN_SIDE } from '../src/gen/level';
import { LIGHT_SNACKS, OUTLINE_KEY, SNACK_CYCLE_FROM, isBreather } from '../src/gen/params';

describe('snacks (GENERATOR.md §1)', () => {
  it('at least 24 original snacks with unique ids', () => {
    expect(SNACKS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(SNACKS.map((s) => s.id)).size).toBe(SNACKS.length);
    expect(snackById('apple').id).toBe('apple');
    expect(() => snackById('nope')).toThrow();
  });

  it('every snack fits the size and colour limits, with the outline added', () => {
    for (const s of SNACKS) {
      const withOutline = outline(s.rows, OUTLINE_KEY);
      for (const rows of [s.rows, withOutline]) {
        const h = rows.length;
        const w = rows[0]?.length ?? 0;
        expect(
          rows.every((r) => r.length === w),
          s.id,
        ).toBe(true);
        expect(Math.min(w, h), s.id).toBeGreaterThanOrEqual(MIN_SIDE);
        expect(Math.max(w, h), s.id).toBeLessThanOrEqual(MAX_SIDE);
        const { keys, board } = parsePicture(rows);
        expect(keys.length, s.id).toBeLessThanOrEqual(MAX_COLOURS);
        for (const k of keys) expect(PALETTE[k], `${s.id}: ${k}`).toBeDefined();
        expect(pixelsLeft(board), s.id).toBeGreaterThan(20);
      }
      expect(s.rows.join('')).not.toContain(OUTLINE_KEY);
    }
  });

  it('the outline wraps the picture one cell wide and is the only exposed colour', () => {
    const rows = outline(['rg', 'gr'], OUTLINE_KEY);
    expect(rows).toEqual(['.dd.', 'drgd', 'dgrd', '.dd.']);
    // an enclosed hole stays a hole; only the outside gets ink
    expect(outline(['rrrr', 'r..r', 'rrrr'], OUTLINE_KEY)).toEqual([
      '.dddd.',
      'drrrrd',
      'dr..rd',
      'drrrrd',
      '.dddd.',
    ]);
    expect(mirror(['ab.', 'c..'])).toEqual(['.ba', '..c']);
  });

  it('levels 1–30 meet the snacks in order; later ones cycle, light snacks on breathers only', () => {
    expect(snackForLevel(1).id).toBe(SNACKS[0]?.id);
    expect(snackForLevel(30).id).toBe(SNACKS[29]?.id);
    expect(snackForLevel(31).id.endsWith('-m')).toBe(true);
    const base = (n: number): string => snackForLevel(n).id.replace(/-m$/, '');
    for (const id of LIGHT_SNACKS) expect(() => snackById(id)).not.toThrow();
    for (let n = 31; n <= 200; n++) {
      expect(() => snackById(base(n))).not.toThrow();
      expect(LIGHT_SNACKS.includes(base(n)), `level ${String(n)}`).toBe(isBreather(n));
      expect(SNACKS.findIndex((p) => p.id === base(n))).toBeGreaterThanOrEqual(SNACK_CYCLE_FROM);
    }
    // the breathers of 31–100 meet every light snack once; the heavy ones all come round
    const breathers = Array.from({ length: 70 }, (_, i) => i + 31).filter(isBreather);
    expect(new Set(breathers.map(base)).size).toBe(LIGHT_SNACKS.length);
    const heavy = Array.from({ length: 70 }, (_, i) => i + 31).filter((n) => !isBreather(n));
    expect(new Set(heavy.map(base)).size).toBe(
      SNACKS.length - SNACK_CYCLE_FROM - LIGHT_SNACKS.length,
    );
  });

  it('palette colours are distinct and the outline is the darkest', () => {
    const values = Object.values(PALETTE);
    expect(new Set(values).size).toBe(values.length);
    const lum = (c: number): number =>
      0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255);
    const outlineLum = lum(colourOf(OUTLINE_KEY));
    for (const [k, c] of Object.entries(PALETTE)) {
      if (k !== OUTLINE_KEY) expect(lum(c), k).toBeGreaterThan(outlineLum);
    }
  });
});
