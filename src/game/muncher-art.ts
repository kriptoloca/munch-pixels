/**
 * The munchers (GDD §4): round blobs, one per colour, with big eyes and a big mouth; drawn
 * procedurally (no runtime tint, CLAUDE.md "Rendering"). Pure geometry: shapes in a unit box
 * (−0.5…0.5 on both axes, y down) that the game draws into canvas textures at Boot
 * (src/game/textures.ts) and that a Node script can render as SVG (`svgOf`, Epic 6's icon).
 *
 * A muncher is two layers: its body in its own colour (one texture per palette colour; the
 * body fill is exactly the palette colour, the shading is baked around it), and a shared
 * expression overlay in neutral colours (one texture per expression and tone). 13+ and never
 * baby-faced (GDD §4): eyes high and not oversized, brows, a wide mouth with a fang.
 */

import { CHIP_FONT_GROW, DIGIT_MIN_PX } from '../config';

/** A path command in unit coordinates. */
export type PathCmd =
  | readonly ['M', number, number]
  | readonly ['L', number, number]
  | readonly ['Q', number, number, number, number]
  | readonly ['Z'];

export type Prim =
  | {
      kind: 'ellipse';
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      /** Rotation in radians. */
      rot?: number;
      fill?: number;
      stroke?: number;
      /** Stroke width in units. */
      width?: number;
    }
  | {
      kind: 'path';
      d: readonly PathCmd[];
      fill?: number;
      stroke?: number;
      width?: number;
    };

export type Expression = 'idle' | 'eating' | 'waiting' | 'waking' | 'full' | 'stuck' | 'queue';
export const EXPRESSIONS: readonly Expression[] = [
  'idle',
  'eating',
  'waiting',
  'waking',
  'full',
  'stuck',
  'queue',
];

/** Features drawn dark (on every body but the darkest) or light (on the ink body). */
export type FaceTone = 'light' | 'dark';

// ---- geometry (unit box) --------------------------------------------------------------------

/** The body: an ellipse a little wider than tall, sitting low in the box. */
export const BODY = { cx: 0, cy: 0.04, rx: 0.44, ry: 0.41 } as const;
/** Outline width around the body (the ink muncher's light ring has the same width). */
export const OUTLINE = 0.035;
/** Shadow crescent: the body ellipse shrunk and moved up-left over a darker copy. */
const SHADE_SHIFT_X = -0.025;
const SHADE_SHIFT_Y = -0.04;
const SHADE_SHRINK = 0.03;
/** Highlight: a small tilted oval at the upper left. */
const SHINE = { cx: -0.24, cy: -0.14, rx: 0.08, ry: 0.045, rot: -0.9 } as const;
/** Feet: two nubs under the body. */
const FEET = { dx: 0.17, cy: 0.42, rx: 0.1, ry: 0.055 } as const;
/** Belly patch, where the appetite digit sits (front and seated munchers). */
export const BELLY = { cx: 0, cy: 0.27, rx: 0.23, ry: 0.12 } as const;
/** Shading mixes (towards black or white) of the body colour. */
const MIX_SHADE = 0.22;
const MIX_OUTLINE = 0.55;
const MIX_FEET = 0.35;
const MIX_SHINE = 0.45;
const MIX_BELLY = 0.16;

/** Eyes: centres, size; pupils. */
export const EYE = { dx: 0.15, cy: -0.16, rx: 0.09, ry: 0.105 } as const;
const PUPIL_R = 0.047;
/** A thin ink ring keeps the eyes readable on the lightest bodies (cream). */
const EYE_RING_W = 0.016;
/** Brows: a short stroke above each eye. */
const BROW_RISE = 0.05;
const BROW_HALF = 0.075;
const BROW_W = 0.035;
/** Mouth line width and colours. */
const MOUTH_W = 0.035;

/** Neutral feature colours (the same on every body). */
export const FEATURE = {
  white: 0xf5f1e6,
  ink: 0x1b1f2a,
  mouth: 0x2a1418,
  tongue: 0xd9576b,
  light: 0xd8dce8,
} as const;

/** Bodies darker than this relative luminance get light features (only the ink `d`). */
export const DARK_BODY_LUMINANCE = 0.03;

// ---- colour helpers -------------------------------------------------------------------------

/** `a` moved towards `b` by `t` (0..1), per channel. */
export function mixColour(a: number, b: number, t: number): number {
  const ch = (s: number): number => {
    const x = (a >> s) & 255;
    const y = (b >> s) & 255;
    return Math.round(x + (y - x) * t) << s;
  };
  return ch(16) | ch(8) | ch(0);
}

/** WCAG relative luminance (0 black … 1 white). */
export function luminance(c: number): number {
  const lin = (v: number): number => {
    const u = v / 255;
    return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((c >> 16) & 255) + 0.7152 * lin((c >> 8) & 255) + 0.0722 * lin(c & 255);
}

export function faceToneFor(body: number): FaceTone {
  return luminance(body) < DARK_BODY_LUMINANCE ? 'dark' : 'light';
}

// ---- the body -------------------------------------------------------------------------------

/**
 * One muncher body in `colour`: feet, outline (a light ring on the ink body, `ring`), shadow,
 * the body itself in exactly `colour`, a belly patch and a highlight.
 */
export function muncherBody(colour: number, ring: number): Prim[] {
  const dark = faceToneFor(colour) === 'dark';
  const outline = dark ? ring : mixColour(colour, 0x000000, MIX_OUTLINE);
  const feet = dark ? mixColour(colour, 0xffffff, MIX_BELLY) : mixColour(colour, 0, MIX_FEET);
  const { cx, cy, rx, ry } = BODY;
  return [
    { kind: 'ellipse', cx: -FEET.dx, cy: FEET.cy, rx: FEET.rx, ry: FEET.ry, fill: feet },
    { kind: 'ellipse', cx: FEET.dx, cy: FEET.cy, rx: FEET.rx, ry: FEET.ry, fill: feet },
    { kind: 'ellipse', cx, cy, rx: rx + OUTLINE, ry: ry + OUTLINE, fill: outline },
    { kind: 'ellipse', cx, cy, rx, ry, fill: mixColour(colour, 0x000000, MIX_SHADE) },
    {
      kind: 'ellipse',
      cx: cx + SHADE_SHIFT_X,
      cy: cy + SHADE_SHIFT_Y,
      rx: rx - SHADE_SHRINK,
      ry: ry - SHADE_SHRINK,
      fill: colour,
    },
    { kind: 'ellipse', ...BELLY, fill: mixColour(colour, 0xffffff, MIX_BELLY) },
    { kind: 'ellipse', ...SHINE, fill: mixColour(colour, 0xffffff, MIX_SHINE) },
  ];
}

// ---- the faces ------------------------------------------------------------------------------

interface EyeSpec {
  /** Eye white size factor (1 = EYE). */
  size: number;
  /** Pupil offset (units) and size factor. */
  px: number;
  py: number;
  pr: number;
  /** Brow: lift above the default and tilt (positive = outer ends up). */
  browLift: number;
  browTilt: number;
  /** Upper lid closed down to this share of the eye (0 = open, 0.5 = half shut). */
  lid: number;
}

const EYES: Record<Expression, EyeSpec> = {
  // a sideways glance and level brows tilted in: a mischievous look, not a baby stare
  idle: { size: 1, px: 0.02, py: 0.015, pr: 1, browLift: 0, browTilt: 0.25, lid: 0.12 },
  eating: { size: 0.95, px: 0, py: 0.02, pr: 1, browLift: -0.01, browTilt: 0.35, lid: 0.3 },
  waiting: { size: 1, px: 0, py: -0.045, pr: 1, browLift: 0.025, browTilt: -0.15, lid: 0 },
  waking: { size: 1.18, px: 0, py: 0, pr: 0.75, browLift: 0.05, browTilt: -0.1, lid: 0 },
  full: { size: 1, px: 0.01, py: 0.03, pr: 0.9, browLift: -0.005, browTilt: 0.1, lid: 0.5 },
  stuck: { size: 1, px: 0, py: 0.045, pr: 1, browLift: 0.01, browTilt: -0.55, lid: 0.15 },
  queue: { size: 1, px: 0.02, py: 0.015, pr: 1, browLift: 0, browTilt: 0.25, lid: 0.12 },
};

/** Mouth centre height (units). */
const MOUTH_Y = -0.01;

function eyes(e: EyeSpec, tone: FaceTone): Prim[] {
  const out: Prim[] = [];
  const rx = EYE.rx * e.size;
  const ry = EYE.ry * e.size;
  const features = tone === 'dark' ? FEATURE.light : FEATURE.ink;
  for (const side of [-1, 1]) {
    const cx = side * EYE.dx;
    const cy = EYE.cy;
    out.push({
      kind: 'ellipse',
      cx,
      cy,
      rx,
      ry,
      fill: FEATURE.white,
      stroke: FEATURE.ink,
      width: EYE_RING_W,
    });
    out.push({
      kind: 'ellipse',
      cx: cx + e.px,
      cy: cy + e.py,
      rx: PUPIL_R * e.pr,
      ry: PUPIL_R * e.pr,
      fill: FEATURE.ink,
    });
    if (e.lid > 0) {
      // The upper lid: a band over the top of the eye down to `lid`, with a firm edge.
      const top = cy - ry - 0.01;
      const edge = cy - ry + 2 * ry * e.lid;
      out.push({
        kind: 'path',
        d: [
          ['M', cx - rx - 0.01, top],
          ['L', cx + rx + 0.01, top],
          ['L', cx + rx + 0.01, edge],
          ['L', cx - rx - 0.01, edge],
          ['Z'],
        ],
        fill: LID_FILL,
      });
      out.push({
        kind: 'path',
        d: [
          ['M', cx - rx, edge],
          ['L', cx + rx, edge],
        ],
        stroke: features,
        width: BROW_W * 0.8,
      });
    }
    // Brow: outer end up by browTilt × half-length.
    const by = cy - ry - BROW_RISE - e.browLift;
    const inner = cx - side * BROW_HALF;
    const outer = cx + side * BROW_HALF;
    const tilt = e.browTilt * BROW_HALF;
    out.push({
      kind: 'path',
      d: [
        ['M', inner, by + tilt],
        ['L', outer, by - tilt],
      ],
      stroke: features,
      width: BROW_W,
    });
  }
  return out;
}

/**
 * The lid band is filled with this marker colour: the texture renderer replaces it with nothing
 * (it clears the band), so the body shows through and the overlay stays colour-free.
 */
export const LID_FILL = -1;

function mouth(expr: Expression, tone: FaceTone): Prim[] {
  const line = tone === 'dark' ? FEATURE.light : FEATURE.mouth;
  const y = MOUTH_Y;
  switch (expr) {
    case 'idle':
      // a wide closed grin with one fang
      return [
        {
          kind: 'path',
          d: [
            ['M', -0.17, y - 0.01],
            ['Q', 0, y + 0.1, 0.17, y - 0.01],
          ],
          stroke: line,
          width: MOUTH_W,
        },
        {
          kind: 'path',
          d: [['M', 0.06, y + 0.03], ['L', 0.1, y + 0.025], ['L', 0.085, y + 0.075], ['Z']],
          fill: FEATURE.white,
        },
      ];
    case 'eating':
      // wide open: a dark mouth, a tongue, two teeth on top
      return [
        { kind: 'ellipse', cx: 0, cy: y + 0.03, rx: 0.17, ry: 0.105, fill: FEATURE.mouth },
        { kind: 'ellipse', cx: 0.02, cy: y + 0.095, rx: 0.09, ry: 0.035, fill: FEATURE.tongue },
        {
          kind: 'path',
          d: [['M', -0.1, y - 0.06], ['L', -0.05, y - 0.065], ['L', -0.075, y - 0.015], ['Z']],
          fill: FEATURE.white,
        },
        {
          kind: 'path',
          d: [['M', 0.05, y - 0.065], ['L', 0.1, y - 0.06], ['L', 0.075, y - 0.015], ['Z']],
          fill: FEATURE.white,
        },
        ...(tone === 'dark'
          ? [
              {
                kind: 'ellipse' as const,
                cx: 0,
                cy: y + 0.03,
                rx: 0.17,
                ry: 0.105,
                stroke: line,
                width: MOUTH_W * 0.6,
              },
            ]
          : []),
      ];
    case 'waiting':
      // mouth open, waiting for its pixels
      return [
        {
          kind: 'ellipse',
          cx: 0,
          cy: y + 0.04,
          rx: 0.09,
          ry: 0.075,
          fill: FEATURE.mouth,
          ...(tone === 'dark' ? { stroke: line, width: MOUTH_W * 0.6 } : {}),
        },
        { kind: 'ellipse', cx: 0, cy: y + 0.085, rx: 0.05, ry: 0.025, fill: FEATURE.tongue },
      ];
    case 'waking':
      // a small "o"
      return [
        {
          kind: 'ellipse',
          cx: 0,
          cy: y + 0.04,
          rx: 0.05,
          ry: 0.055,
          fill: FEATURE.mouth,
          ...(tone === 'dark' ? { stroke: line, width: MOUTH_W * 0.6 } : {}),
        },
      ];
    case 'full':
      // a smug, lopsided closed smile
      return [
        {
          kind: 'path',
          d: [
            ['M', -0.14, y + 0.02],
            ['Q', 0.01, y + 0.1, 0.16, y - 0.03],
          ],
          stroke: line,
          width: MOUTH_W,
        },
      ];
    case 'stuck':
      // a small flat frown
      return [
        {
          kind: 'path',
          d: [
            ['M', -0.09, y + 0.07],
            ['Q', 0, y + 0.02, 0.09, y + 0.07],
          ],
          stroke: line,
          width: MOUTH_W,
        },
      ];
    case 'queue':
      // in the queue the digit fills the lower face
      return [];
  }
}

/** One expression overlay (features only; transparent elsewhere). */
export function muncherFace(expr: Expression, tone: FaceTone): Prim[] {
  return [...eyes(EYES[expr], tone), ...mouth(expr, tone)];
}

/** Where the pupils of an expression look (unit offsets, tests). */
export function pupilOffset(expr: Expression): { x: number; y: number } {
  return { x: EYES[expr].px, y: EYES[expr].py };
}

/** The appetite digit (unit centre and font size as a share of the muncher size). */
export const DIGIT_FRONT = { cy: 0.27, size: 0.28 } as const;
/** In the queue the digit sits lower-centre and larger (it must read at half size). */
export const DIGIT_QUEUE = { cy: 0.19, size: 0.55 } as const;

/**
 * Font size (design px) of the "+N" chip that stands for the munchers past a den's last place:
 * CHIP_FONT_GROW × a queued muncher's digit (audit fix: it was smaller than the digits it stood
 * for, under DIGIT_MIN_PX on 1:1), never under DIGIT_MIN_PX.
 */
export function chipFontPx(miniSize: number): number {
  return Math.max(DIGIT_MIN_PX, Math.round(miniSize * DIGIT_QUEUE.size * CHIP_FONT_GROW));
}
/** Where the bites go in: the mouth centre (unit offset from the muncher centre). */
export const MOUTH_AT = { x: 0, y: MOUTH_Y + 0.03 } as const;

// ---- SVG (Node: previews, Epic 6's icon) ----------------------------------------------------

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

function svgPath(d: readonly PathCmd[], s: number): string {
  const u = (v: number): string => ((v + 0.5) * s).toFixed(2);
  return d
    .map((c) => {
      switch (c[0]) {
        case 'M':
        case 'L':
          return `${c[0]}${u(c[1])} ${u(c[2])}`;
        case 'Q':
          return `Q${u(c[1])} ${u(c[2])} ${u(c[3])} ${u(c[4])}`;
        case 'Z':
          return 'Z';
      }
    })
    .join(' ');
}

/**
 * The shapes as SVG elements in an `s`-pixel box. A face over a body passes the body colour as
 * `lid` (the eyelids are skin); without it the lid bands are skipped.
 */
export function svgOf(prims: readonly Prim[], s: number, lid?: number): string {
  const paint = (p: Prim): string => {
    const fill = p.fill === undefined ? 'none' : p.fill === LID_FILL ? hex(lid ?? 0) : hex(p.fill);
    const stroke =
      p.stroke === undefined
        ? ''
        : ` stroke="${hex(p.stroke)}" stroke-width="${((p.width ?? 0) * s).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"`;
    return `fill="${fill}"${stroke}`;
  };
  return prims
    .filter((p) => p.fill !== LID_FILL || lid !== undefined)
    .map((p) => {
      if (p.kind === 'ellipse') {
        const cx = ((p.cx + 0.5) * s).toFixed(2);
        const cy = ((p.cy + 0.5) * s).toFixed(2);
        const rot = p.rot
          ? ` transform="rotate(${((p.rot * 180) / Math.PI).toFixed(2)} ${cx} ${cy})"`
          : '';
        return `<ellipse cx="${cx}" cy="${cy}" rx="${(p.rx * s).toFixed(2)}" ry="${(p.ry * s).toFixed(2)}"${rot} ${paint(p)}/>`;
      }
      return `<path d="${svgPath(p.d, s)}" ${paint(p)}/>`;
    })
    .join('');
}
