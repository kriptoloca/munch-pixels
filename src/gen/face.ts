import { Rng } from './rng';

/**
 * The hidden face under a snack (GENERATOR.md §7, GDD §4): a creature face drawn from parts on the
 * snack's own grid, so it shows through the eaten cells pixel for pixel. Integer and polynomial
 * geometry only (no sin/cos), so every engine draws the same face for a seed. Deep backgrounds
 * and mid-tone heads: no nursery pastels.
 */

/**
 * Face colours: a muted "dusty" family kept apart from the vivid snack palette (CIE76 ΔE ≥ 18 to
 * every snack colour, tests/face.test.ts), so a revealed face cell never looks like a pixel that
 * is still to be eaten (docs/questions.md, Epic 2 review). Deep backgrounds, mid-tone heads: no
 * nursery pastels.
 */
export const FACE_BACKGROUNDS = [0x2a366f, 0x4c3267, 0x326755, 0x3c4319, 0x60244c] as const;
export const FACE_HEADS = [0x9d91b6, 0x7489b4, 0x8d9d6c, 0xa97e94, 0x7ea986, 0xbf889a] as const;
/** Pupils, brows and mouths: a warm near-black, apart from the cool outline ink (`d`). */
export const FACE_DARK = 0x2b1a10;
/** Eye whites and horns: a cool pale blue, apart from the cream snack colour (`w`). */
export const FACE_WHITE = 0xc6d9ec;
export const FACE_TONGUE = 0x8a4a6a;
export const FACE_CHEEK = 0xcf9a86;

/** Head centre below the grid centre, as a share of the height (room for ears or horns). */
const HEAD_DROP = 0.06;
/** Head radii as shares of the grid: wide heads are wider and flatter. */
const HEAD_RX = 0.42;
const HEAD_RY = 0.42;
const WIDE_RX = 0.47;
const WIDE_RY = 0.38;
/** Eyes sit this share of the head's y-radius above its centre, this share of rx apart. */
const EYE_RISE = 0.25;
const EYE_SPREAD = 0.42;
/** The mouth sits this share of ry below the centre; its half-width is this share of rx. */
const MOUTH_DROP = 0.45;
const MOUTH_HALF = 0.35;
/** Big eyes (two cells wide) need at least this grid. */
const BIG_EYES_MIN_W = 12;
const BIG_EYES_MIN_H = 10;
/** Chance of cheeks. */
const CHEEK_CHANCE = 0.5;

export type HeadShape = 'round' | 'square' | 'wide';
export type EyeStyle = 'dot' | 'big' | 'sleepy' | 'cyclops' | 'angry';
export type MouthStyle = 'grin' | 'open' | 'fang' | 'smirk' | 'zigzag';
export type Extra = 'none' | 'ears' | 'horns' | 'antenna';

export interface FaceParts {
  background: number;
  head: number;
  shape: HeadShape;
  eyes: EyeStyle;
  mouth: MouthStyle;
  extra: Extra;
  cheeks: boolean;
}

export interface FacePicture {
  w: number;
  h: number;
  /** One colour per cell, row-major. */
  px: number[];
  parts: FaceParts;
  /** Cells the eyes and the mouth were drawn on (the win blink and grin touch only these). */
  eyeCells: number[];
  mouthCells: number[];
}

/**
 * Variants of a face (D6, the win): the same seed and parts, only the eyes shut for the blink
 * (a lid line where an eye is wider than a cell, the head where it is a single dot) or the mouth
 * redrawn in another style (the grin). No option: the face as players always saw it.
 */
export interface FaceOptions {
  eyesClosed?: boolean;
  mouth?: MouthStyle;
}

const SHAPES: readonly HeadShape[] = ['round', 'square', 'wide'];
const EYES: readonly EyeStyle[] = ['dot', 'big', 'sleepy', 'cyclops', 'angry'];
const MOUTHS: readonly MouthStyle[] = ['grin', 'open', 'fang', 'smirk', 'zigzag'];
const EXTRAS: readonly Extra[] = ['none', 'ears', 'horns', 'antenna'];

export function faceParts(seed: number): FaceParts {
  const rng = new Rng(seed);
  return {
    background: rng.pick(FACE_BACKGROUNDS),
    head: rng.pick(FACE_HEADS),
    shape: rng.pick(SHAPES),
    eyes: rng.pick(EYES),
    mouth: rng.pick(MOUTHS),
    extra: rng.pick(EXTRAS),
    cheeks: rng.chance(CHEEK_CHANCE),
  };
}

export function drawFace(seed: number, w: number, h: number, opts: FaceOptions = {}): FacePicture {
  const seeded = faceParts(seed);
  const parts = opts.mouth ? { ...seeded, mouth: opts.mouth } : seeded;
  const px = new Array<number>(w * h).fill(parts.background);
  /** The feature being drawn records its cells here (the eyes: one group per eye). */
  let record: number[] | null = null;
  const set = (x: number, y: number, c: number): void => {
    if (x >= 0 && y >= 0 && x < w && y < h) {
      px[y * w + x] = c;
      record?.push(y * w + x);
    }
  };
  // Head: centred a little low, leaving room for ears or horns on top.
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2 + h * HEAD_DROP;
  const rx = w * (parts.shape === 'wide' ? WIDE_RX : HEAD_RX);
  const ry = h * (parts.shape === 'wide' ? WIDE_RY : HEAD_RY);
  let top = h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const inside =
        parts.shape === 'square'
          ? dx * dx * dx * dx + dy * dy * dy * dy <= 1
          : dx * dx + dy * dy <= 1;
      if (inside) {
        set(x, y, parts.head);
        top = Math.min(top, y);
      }
    }
  }
  const eyeY = Math.round(cy - ry * EYE_RISE);
  const eyeDX = Math.max(1, Math.round(rx * EYE_SPREAD));
  const lx = Math.round(cx - eyeDX);
  const rxp = Math.round(cx + eyeDX);
  const big = w >= BIG_EYES_MIN_W && h >= BIG_EYES_MIN_H;
  /** One group of cells per eye: the blink shuts each eye whole, whatever side it sits on. */
  const eyes: number[][] = [];
  const nextEye = (): void => {
    record = [];
    eyes.push(record);
  };
  switch (parts.eyes) {
    case 'dot':
      nextEye();
      set(lx, eyeY, FACE_DARK);
      nextEye();
      set(rxp, eyeY, FACE_DARK);
      break;
    case 'big':
      for (const ex of [lx, rxp]) {
        nextEye();
        set(ex, eyeY, FACE_WHITE);
        if (big) {
          set(ex - 1, eyeY, FACE_WHITE);
          set(ex - 1, eyeY - 1, FACE_WHITE);
          set(ex, eyeY - 1, FACE_WHITE);
          set(ex, eyeY, FACE_DARK);
        } else {
          set(ex, eyeY, FACE_DARK);
        }
      }
      break;
    case 'sleepy':
      for (const ex of [lx, rxp]) {
        nextEye();
        set(ex, eyeY, FACE_DARK);
        set(ex + (ex < cx ? -1 : 1), eyeY, FACE_DARK);
      }
      break;
    case 'cyclops': {
      const ex = Math.round(cx);
      nextEye();
      set(ex, eyeY, FACE_WHITE);
      if (big) {
        set(ex - 1, eyeY, FACE_WHITE);
        set(ex + 1, eyeY, FACE_WHITE);
        set(ex, eyeY - 1, FACE_WHITE);
        set(ex, eyeY + 1, FACE_WHITE);
      }
      set(ex, eyeY, FACE_DARK);
      break;
    }
    case 'angry':
      nextEye();
      set(lx, eyeY, FACE_DARK);
      nextEye();
      set(rxp, eyeY, FACE_DARK);
      // the brows are not eyes: they stay through the blink
      record = null;
      set(lx - 1, eyeY - 2, FACE_DARK);
      set(lx, eyeY - 1, FACE_DARK);
      set(rxp + 1, eyeY - 2, FACE_DARK);
      set(rxp, eyeY - 1, FACE_DARK);
      break;
  }
  record = null;
  if (opts.eyesClosed) closeEyes(px, w, eyes, eyeY, parts.head);
  const eyeCells = eyes.flat();
  const mouthY = Math.min(h - 2, Math.round(cy + ry * MOUTH_DROP));
  const half = Math.max(1, Math.round(rx * MOUTH_HALF));
  const mx0 = Math.round(cx - half);
  const mx1 = Math.round(cx + half);
  const mouthCells: number[] = [];
  record = mouthCells;
  switch (parts.mouth) {
    case 'grin':
      for (let x = mx0 + 1; x < mx1; x++) set(x, mouthY, FACE_DARK);
      set(mx0, mouthY - 1, FACE_DARK);
      set(mx1, mouthY - 1, FACE_DARK);
      break;
    case 'open':
      for (let x = mx0; x <= mx1; x++) set(x, mouthY, FACE_DARK);
      for (let x = mx0 + 1; x < mx1; x++) set(x, mouthY + 1, FACE_DARK);
      set(Math.round(cx), mouthY + 1, FACE_TONGUE);
      break;
    case 'fang':
      for (let x = mx0; x <= mx1; x++) set(x, mouthY, FACE_DARK);
      set(mx0 + 1, mouthY + 1, FACE_WHITE);
      break;
    case 'smirk':
      for (let x = mx0; x <= mx1; x++) set(x, mouthY, FACE_DARK);
      set(mx1 + 1, mouthY - 1, FACE_DARK);
      break;
    case 'zigzag':
      for (let x = mx0; x <= mx1; x++) set(x, mouthY + ((x - mx0) % 2), FACE_DARK);
      break;
  }
  record = null;
  if (parts.cheeks) {
    set(lx - 1, mouthY - 1, FACE_CHEEK);
    set(rxp + 1, mouthY - 1, FACE_CHEEK);
  }
  const above = top - 1;
  switch (parts.extra) {
    case 'ears':
      for (const ex of [lx - 1, rxp + 1]) {
        set(ex, above, parts.head);
        set(ex, above + 1, parts.head);
      }
      break;
    case 'horns':
      set(lx, above, FACE_WHITE);
      set(rxp, above, FACE_WHITE);
      break;
    case 'antenna': {
      const ax = Math.round(cx);
      set(ax, above, FACE_DARK);
      set(ax, above - 1, FACE_CHEEK);
      break;
    }
    case 'none':
      break;
  }
  return { w, h, px, parts, eyeCells, mouthCells };
}

/**
 * The blink, eye by eye (the groups the drawing recorded, so a centred cyclops eye stays one
 * eye): an eye with whites shuts to a dark lid line across its whole width on its eye row and the
 * rest of it becomes the head; an eye that is all dark already (a dot, a sleepy line) vanishes
 * into the head for the blink.
 */
function closeEyes(
  px: number[],
  w: number,
  eyes: readonly (readonly number[])[],
  eyeY: number,
  head: number,
): void {
  for (const cells of eyes) {
    const eye = [...new Set(cells)];
    const row = eye.filter((i) => Math.floor(i / w) === eyeY);
    const lid = row.length > 1 && eye.some((i) => px[i] !== FACE_DARK);
    for (const i of eye) px[i] = head;
    if (lid) for (const i of row) px[i] = FACE_DARK;
  }
}
