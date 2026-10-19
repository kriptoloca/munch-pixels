/**
 * The snack board and its geometry (GENERATOR.md §2): open ground, exposure and the reachable
 * pixels of a colour in eating order. Pure, no Phaser; cells are a flat array, index = y·w + x.
 */

/** A transparent cell of the picture. */
export const EMPTY = -1;
/** A pixel that has been eaten. */
export const EATEN = -2;

export interface Board {
  readonly w: number;
  readonly h: number;
  /** Colour index ≥ 0, EMPTY or EATEN. */
  readonly cells: Int8Array;
}

export interface ParsedPicture {
  board: Board;
  /** Palette key of each colour index, in order of first appearance (row-major). */
  keys: string[];
}

/** Transparent cell in picture rows. */
export const TRANSPARENT = '.';

/** Builds a board from picture rows ('.' transparent, any other character a palette key). */
export function parsePicture(rows: readonly string[]): ParsedPicture {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  if (h === 0 || w === 0) throw new Error('empty picture');
  const keys: string[] = [];
  const cells = new Int8Array(w * h);
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`row ${String(y)} has length ${String(row.length)}`);
    for (let x = 0; x < w; x++) {
      const ch = row[x] as string;
      if (ch === TRANSPARENT) {
        cells[y * w + x] = EMPTY;
        continue;
      }
      let k = keys.indexOf(ch);
      if (k === -1) {
        keys.push(ch);
        k = keys.length - 1;
      }
      cells[y * w + x] = k;
    }
  });
  return { board: { w, h, cells }, keys };
}

export function cloneBoard(b: Board): Board {
  return { w: b.w, h: b.h, cells: b.cells.slice() };
}

export function isPixel(v: number): boolean {
  return v >= 0;
}

/** Pixels not eaten yet. */
export function pixelsLeft(b: Board): number {
  let n = 0;
  for (const v of b.cells) if (v >= 0) n += 1;
  return n;
}

/** Pixels left per colour index (length = number of colours). */
export function countByColour(b: Board, colours: number): number[] {
  const out = new Array<number>(colours).fill(0);
  for (const v of b.cells) if (v >= 0) out[v] = (out[v] as number) + 1;
  return out;
}

/**
 * Open ground inside the grid: EMPTY or EATEN cells connected to the outside through EMPTY or
 * EATEN cells (4-neighbourhood). An enclosed hole stays closed until something next to it opens.
 */
export function openGround(b: Board): Uint8Array {
  const { w, h, cells } = b;
  const open = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (i: number): void => {
    if (open[i] === 1 || (cells[i] as number) >= 0) return;
    open[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const x = i % w;
    const y = (i - x) / w;
    if (y > 0) push(i - w);
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y < h - 1) push(i + w);
  }
  return open;
}

/** A pixel with a side on the outside or on open ground. */
export function isExposed(b: Board, open: Uint8Array, i: number): boolean {
  if ((b.cells[i] as number) < 0) return false;
  const { w, h } = b;
  const x = i % w;
  const y = (i - x) / w;
  if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return true;
  return open[i - w] === 1 || open[i - 1] === 1 || open[i + 1] === 1 || open[i + w] === 1;
}

/**
 * The pixels of `colour` a muncher can reach, in eating order: breadth-first over pixels of that
 * colour, seeded with its exposed pixels in row-major order, neighbours up, left, right, down.
 */
export function reachable(b: Board, colour: number, open: Uint8Array = openGround(b)): number[] {
  const { w, h, cells } = b;
  const seen = new Uint8Array(w * h);
  const order: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === colour && isExposed(b, open, i)) {
      seen[i] = 1;
      order.push(i);
    }
  }
  const visit = (j: number): void => {
    if (seen[j] === 1 || cells[j] !== colour) return;
    seen[j] = 1;
    order.push(j);
  };
  for (let head = 0; head < order.length; head++) {
    const i = order[head] as number;
    const x = i % w;
    const y = (i - x) / w;
    if (y > 0) visit(i - w);
    if (x > 0) visit(i - 1);
    if (x < w - 1) visit(i + 1);
    if (y < h - 1) visit(i + w);
  }
  return order;
}
