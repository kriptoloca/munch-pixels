import {
  BOARD_GROW_CLEAR,
  BOARD_PAD,
  BOOSTER_BAND_H,
  BOOSTER_R,
  DESIGN_LONG_MAX,
  DESIGN_SHORT,
  GAP,
  HIT_MIN_R,
  HUD_H,
  LANDSCAPE_MIN_ASPECT,
  LANE_SPACING_MAX,
  LEVEL_LABEL_H,
  LEVEL_LABEL_W,
  MARGIN,
  MINI_GAP,
  MINI_SCALE,
  MUNCHER_SCALE,
  PAUSE_R,
  PORTRAIT_MIN_ASPECT,
  QUEUE_GAP,
  QUEUE_MAX_VISIBLE,
  QUEUE_MIN_VISIBLE,
  SIDE_COL_W,
  SLOT_GAP,
  SLOT_MAX,
  SLOT_STROKE,
  SNACK_MAX,
} from '../config';

/** Axis-aligned rectangle in design px. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  width: number;
  height: number;
}

export type Orientation = 'portrait' | 'square' | 'landscape';

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Design canvas size for a viewport (CLAUDE.md rule 5): short side DESIGN_SHORT, long side follows
 * the viewport aspect, clamped to [DESIGN_SHORT, DESIGN_LONG_MAX]. Viewports past the clamp are
 * letterboxed by Scale.FIT.
 */
export function designSize(viewW: number, viewH: number): Size {
  const w = Math.max(1, viewW);
  const h = Math.max(1, viewH);
  if (w >= h) {
    const long = clamp(Math.round(DESIGN_SHORT * (w / h)), DESIGN_SHORT, DESIGN_LONG_MAX);
    return { width: long, height: DESIGN_SHORT };
  }
  const long = clamp(Math.round(DESIGN_SHORT * (h / w)), DESIGN_SHORT, DESIGN_LONG_MAX);
  return { width: DESIGN_SHORT, height: long };
}

export function orientationOf(width: number, height: number): Orientation {
  if (width === height) return 'square';
  return width < height ? 'portrait' : 'landscape';
}

export interface Point {
  x: number;
  y: number;
}

export interface Circle extends Point {
  r: number;
}

/** Where everything of the game screen sits, in design px (GDD §10). Pure; tests/layout.test.ts. */
export interface GameLayout {
  orientation: Orientation;
  width: number;
  height: number;
  /** The level number (left-aligned text anchor, vertically centred). */
  level: Point;
  pause: Circle;
  /** The snack drawing: `cols × cell` by `rows × cell`, centred in its square. */
  snack: Rect;
  /** Pixels per snack cell (an integer, so the pixels stay crisp). */
  cell: number;
  /** Slot centres, left to right; every slot is `slotSize` square. */
  slots: Point[];
  slotSize: number;
  /** Front muncher centre of each den, left to right. */
  lanes: Point[];
  muncherSize: number;
  /** Queued munchers behind the front: their size, the distance between them (downward), and
   * the distance from the front's centre to the first one. */
  miniSize: number;
  miniStep: number;
  queueTop: number;
  /** Places per den, the front included (the last one shows "+N" when more are waiting). */
  queueVisible: number;
  /** Hit circle radius of a muncher. */
  hitR: number;
  boosters: { slot: Circle; undo: Circle };
}

export interface LayoutInput {
  /** Snack grid size in cells. */
  cols: number;
  rows: number;
  slots: number;
  lanes: number;
}

function slotRow(slots: number, cx: number, y: number, size: number): Point[] {
  const step = size + SLOT_GAP;
  const x0 = cx - ((slots - 1) * step) / 2;
  return Array.from({ length: slots }, (_, i) => ({ x: x0 + i * step, y }));
}

function laneRow(lanes: number, cx: number, y: number, width: number): Point[] {
  const step = Math.min(LANE_SPACING_MAX, width / lanes);
  const x0 = cx - ((lanes - 1) * step) / 2;
  return Array.from({ length: lanes }, (_, i) => ({ x: x0 + i * step, y }));
}

/**
 * The game screen for a design size (CLAUDE.md rule 5, GDD §10). Three arrangements:
 * - portrait (H/W ≥ PORTRAIT_MIN_ASPECT): HUD band, snack, slots, dens, booster band, stacked;
 * - square (in between): the same column in the middle, the HUD and boosters in side columns;
 * - landscape (W/H ≥ LANDSCAPE_MIN_ASPECT): the snack on the left, the rest on the right.
 */
export function computeLayout(width: number, height: number, input: LayoutInput): GameLayout {
  const aspect = height / width;
  const orientation: Orientation =
    aspect >= PORTRAIT_MIN_ASPECT
      ? 'portrait'
      : 1 / aspect >= LANDSCAPE_MIN_ASPECT
        ? 'landscape'
        : 'square';
  // The play column: where the slots and the dens go (and the snack, unless landscape).
  let colX0: number;
  let colX1: number;
  let top: number;
  let bottom: number;
  let snackBox: Rect | null = null;
  let level: Point;
  let pause: Circle;
  let boosters: { slot: Circle; undo: Circle };
  if (orientation === 'portrait') {
    colX0 = MARGIN;
    colX1 = width - MARGIN;
    top = HUD_H;
    bottom = height - BOOSTER_BAND_H;
    level = { x: MARGIN, y: HUD_H / 2 };
    pause = { x: width - MARGIN - PAUSE_R, y: HUD_H / 2, r: PAUSE_R };
    const by = height - BOOSTER_BAND_H / 2;
    boosters = {
      slot: { x: MARGIN + BOOSTER_R, y: by, r: BOOSTER_R },
      undo: { x: width - MARGIN - BOOSTER_R, y: by, r: BOOSTER_R },
    };
  } else if (orientation === 'square') {
    colX0 = SIDE_COL_W;
    colX1 = width - SIDE_COL_W;
    top = GAP;
    bottom = height - GAP;
    const sx = SIDE_COL_W / 2;
    level = { x: GAP, y: MARGIN + PAUSE_R };
    pause = { x: width - sx, y: MARGIN + PAUSE_R, r: PAUSE_R };
    const by = height - MARGIN - BOOSTER_R;
    boosters = {
      slot: { x: sx, y: by, r: BOOSTER_R },
      undo: { x: width - sx, y: by, r: BOOSTER_R },
    };
  } else {
    const half = Math.round(width / 2);
    const side = Math.min(SNACK_MAX, half - 2 * MARGIN, height - 2 * MARGIN);
    snackBox = { x: (half - side) / 2, y: (height - side) / 2, w: side, h: side };
    colX0 = half + MARGIN;
    colX1 = width - MARGIN;
    top = HUD_H;
    bottom = height - BOOSTER_BAND_H;
    level = { x: colX0, y: HUD_H / 2 };
    pause = { x: colX1 - PAUSE_R, y: HUD_H / 2, r: PAUSE_R };
    const by = height - BOOSTER_BAND_H / 2;
    boosters = {
      slot: { x: colX0 + BOOSTER_R, y: by, r: BOOSTER_R },
      undo: { x: colX1 - BOOSTER_R, y: by, r: BOOSTER_R },
    };
  }
  const colW = colX1 - colX0;
  const cx = (colX0 + colX1) / 2;
  const slotSize = Math.floor(
    Math.min(SLOT_MAX, (colW - (input.slots - 1) * SLOT_GAP) / input.slots),
  );
  const muncherSize = Math.round(slotSize * MUNCHER_SCALE);
  const miniSize = Math.round(muncherSize * MINI_SCALE);
  const miniStep = miniSize + MINI_GAP;
  const queueTop = muncherSize / 2 + QUEUE_GAP + miniSize / 2;
  const densMin = muncherSize + QUEUE_GAP + miniStep * (QUEUE_MIN_VISIBLE - 1);
  let y = top + GAP;
  if (!snackBox) {
    const room = bottom - top - 3 * GAP - slotSize - densMin;
    const side = Math.max(0, Math.min(SNACK_MAX, colW, room));
    snackBox = { x: cx - side / 2, y, w: side, h: side };
    y += side + GAP;
  }
  const slotY = y + slotSize / 2;
  const frontY = slotY + slotSize / 2 + GAP + muncherSize / 2;
  const queueRoom = bottom - (frontY + muncherSize / 2 + QUEUE_GAP);
  const queueVisible = Math.max(
    1,
    Math.min(QUEUE_MAX_VISIBLE, 1 + Math.floor((queueRoom + MINI_GAP) / miniStep)),
  );
  const cell = Math.max(1, Math.floor(Math.min(snackBox.w / input.cols, snackBox.h / input.rows)));
  const sw = cell * input.cols;
  const sh = cell * input.rows;
  return {
    orientation,
    width,
    height,
    level,
    pause,
    snack: {
      x: Math.round(snackBox.x + (snackBox.w - sw) / 2),
      y: Math.round(snackBox.y + (snackBox.h - sh) / 2),
      w: sw,
      h: sh,
    },
    cell,
    slots: slotRow(input.slots, cx, slotY, slotSize),
    slotSize,
    lanes: laneRow(input.lanes, cx, frontY, colW),
    muncherSize,
    miniSize,
    miniStep,
    queueTop,
    queueVisible,
    hitR: Math.max(HIT_MIN_R, muncherSize / 2),
    boosters,
  };
}

/** The board panel (the snack and its pad) grown `k` times around the snack's centre. */
export function boardRect(l: GameLayout, k: number): Rect {
  const w = (l.snack.w + 2 * BOARD_PAD) * k;
  const h = (l.snack.h + 2 * BOARD_PAD) * k;
  return { x: l.snack.x + (l.snack.w - w) / 2, y: l.snack.y + (l.snack.h - h) / 2, w, h };
}

function circleRect(c: Circle): Rect {
  return { x: c.x - c.r, y: c.y - c.r, w: 2 * c.r, h: 2 * c.r };
}

/** What the grown board must not reach: the HUD, the slot frames, the dens, the boosters. */
function neighbours(l: GameLayout): Rect[] {
  const s = l.slotSize + SLOT_STROKE;
  const first = l.slots[0] as Point;
  const last = l.slots.at(-1) as Point;
  const lane0 = l.lanes[0] as Point;
  const laneN = l.lanes.at(-1) as Point;
  const half = Math.max(l.hitR, l.muncherSize / 2);
  const denTop = lane0.y - l.muncherSize / 2;
  const denBottom = denPoint(l, 0, l.queueVisible - 1).y + l.miniSize / 2;
  return [
    { x: l.level.x, y: l.level.y - LEVEL_LABEL_H / 2, w: LEVEL_LABEL_W, h: LEVEL_LABEL_H },
    circleRect(l.pause),
    { x: first.x - s / 2, y: first.y - s / 2, w: last.x - first.x + s, h: s },
    { x: lane0.x - half, y: denTop, w: laneN.x - lane0.x + 2 * half, h: denBottom - denTop },
    circleRect(l.boosters.slot),
    circleRect(l.boosters.undo),
  ];
}

/**
 * How far the win grows the board on this screen (GDD §3a win row): `want` (WIN_FACE_SCALE)
 * where there is room, less where the grown board would come within BOARD_GROW_CLEAR px of the
 * canvas edge or of a neighbour (audit fix: 1.08 covered the slot frames on 9:16 and 1:1 and ran
 * past the left edge on 16:9); never below 1. The board grows around the snack's centre.
 */
export function winScale(l: GameLayout, want: number): number {
  const b = boardRect(l, 1);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const hx = b.w / 2;
  const hy = b.h / 2;
  const c = BOARD_GROW_CLEAR;
  let k = Math.min(want, (cx - c) / hx, (l.width - c - cx) / hx, (cy - c) / hy);
  k = Math.min(k, (l.height - c - cy) / hy);
  for (const n of neighbours(l)) {
    // the largest k that keeps the board on one side of this neighbour (any side will do)
    let room = 0;
    if (n.x - c >= cx) room = Math.max(room, (n.x - c - cx) / hx);
    if (n.x + n.w + c <= cx) room = Math.max(room, (cx - n.x - n.w - c) / hx);
    if (n.y - c >= cy) room = Math.max(room, (n.y - c - cy) / hy);
    if (n.y + n.h + c <= cy) room = Math.max(room, (cy - n.y - n.h - c) / hy);
    k = Math.min(k, room);
  }
  return Math.max(1, k);
}

/** Centre of place k of a den (0 = the front muncher, then the queue). */
export function denPoint(l: GameLayout, lane: number, k: number): Point {
  const p = l.lanes[lane] as Point;
  if (k === 0) return { x: p.x, y: p.y };
  return { x: p.x, y: p.y + l.queueTop + (k - 1) * l.miniStep };
}

/** What a point on a den hits: a front muncher, a queued one (the nope), or nothing. */
export type DenHit = { kind: 'front' | 'behind'; lane: number; k: number } | null;

/**
 * The den place under a point (CLAUDE.md "Taps"): a point inside a front muncher's hit circle is
 * always that front (nearest front wins), even where a queued muncher's circle reaches into it;
 * otherwise the nearest queued muncher whose circle holds the point. `shown[lane]` is how many
 * places of that den hold a muncher.
 */
export function pickDen(l: GameLayout, shown: readonly number[], x: number, y: number): DenHit {
  let best: DenHit = null;
  let bestD = Number.POSITIVE_INFINITY;
  const consider = (lane: number, k: number): void => {
    const c = denPoint(l, lane, k);
    const d = Math.hypot(x - c.x, y - c.y);
    if (d <= l.hitR && d < bestD) {
      bestD = d;
      best = { kind: k === 0 ? 'front' : 'behind', lane, k };
    }
  };
  shown.forEach((n, lane) => {
    if (n > 0) consider(lane, 0);
  });
  if (best) return best;
  shown.forEach((n, lane) => {
    for (let k = 1; k < n; k++) consider(lane, k);
  });
  return best;
}
