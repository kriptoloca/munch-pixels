/**
 * The snack palette (GENERATOR.md §1): one vivid colour per key, readable on the board background
 * and distinct from its neighbours. Munchers, pixels and crumbs of a colour are drawn in exactly
 * this colour (no runtime tint, CLAUDE.md "Rendering").
 */
export const PALETTE: Readonly<Record<string, number>> = {
  r: 0xe63946, // red
  m: 0x8f2d3a, // maroon (seeds)
  o: 0xf4842d, // orange
  y: 0xffd23f, // yellow
  s: 0xe8b86d, // sand (dough, crust)
  n: 0x8b5a3c, // brown
  g: 0x3fae5a, // green
  l: 0xa7d84b, // lime
  c: 0x33c3d8, // cyan
  b: 0x3d6fd9, // blue
  p: 0x8e5bd6, // purple
  k: 0xf272b6, // pink
  w: 0xf6efe0, // cream
  d: 0x161a26, // outline (near black)
};

/**
 * Board background behind the snack (the eaten cells show the hidden face, not this). Light
 * enough for the near-black outline (`d`) to read against it.
 */
export const COLOR_BOARD = 0x4a5472;

/** At most this many colours in one snack (and so in one level's munchers). */
export const MAX_COLOURS = 7;

export function colourOf(key: string): number {
  const c = PALETTE[key];
  if (c === undefined) throw new Error(`unknown palette key ${key}`);
  return c;
}
