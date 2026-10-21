import { describe, expect, it } from 'vitest';
import { HIT_MIN_R, LEVEL_LABEL_H, LEVEL_LABEL_W, SLOT_STROKE } from '../src/config';
import { WIN_FACE_SCALE } from '../src/game/feel';
import {
  boardRect,
  computeLayout,
  denPoint,
  designSize,
  pickDen,
  winScale,
  type Circle,
  type GameLayout,
  type Rect,
} from '../src/game/layout';

/** CSS viewports: phones (9:16, 20:9), tablets (3:4), square, desktop (16:9, 21:9). */
const VIEWPORTS: readonly [string, number, number][] = [
  ['9:16', 390, 693],
  ['20:9 portrait', 360, 800],
  ['3:4', 768, 1024],
  ['1:1', 800, 800],
  ['4:3', 1024, 768],
  ['16:9', 1280, 720],
  ['21:9', 2560, 1080],
];
const SNACKS: readonly [number, number][] = [
  [6, 6],
  [20, 20],
  [20, 12],
  [12, 20],
  [16, 15],
];
/** The level number is at most three digits (GDD §9) at the HUD size: this box holds it. */
const LEVEL_BOX = { w: LEVEL_LABEL_W, h: LEVEL_LABEL_H };

function circleBox(c: Circle): Rect {
  return { x: c.x - c.r, y: c.y - c.r, w: 2 * c.r, h: 2 * c.r };
}

function boxes(l: GameLayout): Record<string, Rect> {
  const s = l.slotSize;
  const first = l.slots[0] as { x: number; y: number };
  const last = l.slots.at(-1) as { x: number; y: number };
  const lane0 = l.lanes[0] as { x: number; y: number };
  const laneN = l.lanes.at(-1) as { x: number; y: number };
  const half = Math.max(l.hitR, l.muncherSize / 2);
  // the slot frames' line sits on their edge: half of it reaches outside
  const line = SLOT_STROKE / 2;
  return {
    level: { x: l.level.x, y: l.level.y - LEVEL_BOX.h / 2, w: LEVEL_BOX.w, h: LEVEL_BOX.h },
    pause: circleBox(l.pause),
    // the board panel at its largest: grown by the win (WIN_FACE_SCALE, capped per screen)
    board: boardRect(l, winScale(l, WIN_FACE_SCALE)),
    slots: {
      x: first.x - s / 2 - line,
      y: first.y - s / 2 - line,
      w: last.x - first.x + s + 2 * line,
      h: s + 2 * line,
    },
    dens: {
      x: lane0.x - half,
      y: lane0.y - l.muncherSize / 2,
      w: laneN.x - lane0.x + 2 * half,
      h: denPoint(l, 0, l.queueVisible - 1).y + l.miniSize / 2 - (lane0.y - l.muncherSize / 2),
    },
    boosterSlot: circleBox(l.boosters.slot),
    boosterUndo: circleBox(l.boosters.undo),
  };
}

function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Every design size the scale rule can produce, in 40 px steps, plus the named viewports. */
function sizes(): [string, number, number][] {
  const out: [string, number, number][] = VIEWPORTS.map(([n, vw, vh]) => {
    const { width, height } = designSize(vw, vh);
    return [n, width, height];
  });
  for (let long = 1080; long <= 2400; long += 40) {
    out.push([`1080×${String(long)}`, 1080, long], [`${String(long)}×1080`, long, 1080]);
  }
  return out;
}

function each(fn: (name: string, l: GameLayout) => void): void {
  for (const [name, width, height] of sizes()) {
    for (const [cols, rows] of SNACKS) {
      for (const slots of [5, 6]) {
        for (let lanes = 2; lanes <= 5; lanes++) {
          const tag = `${name} ${String(cols)}×${String(rows)} s${String(slots)} l${String(lanes)}`;
          fn(tag, computeLayout(width, height, { cols, rows, slots, lanes }));
        }
      }
    }
  }
}

describe('computeLayout (GDD §10, CLAUDE.md rule 5)', () => {
  it('picks portrait, square and landscape arrangements by aspect', () => {
    const at = (vw: number, vh: number): string => {
      const { width, height } = designSize(vw, vh);
      return computeLayout(width, height, { cols: 16, rows: 16, slots: 5, lanes: 3 }).orientation;
    };
    expect(at(390, 693)).toBe('portrait');
    expect(at(800, 800)).toBe('square');
    expect(at(768, 1024)).toBe('square');
    expect(at(1280, 720)).toBe('landscape');
  });

  it('everything sits inside the canvas, and nothing overlaps', () => {
    each((tag, l) => {
      const b = boxes(l);
      for (const [k, r] of Object.entries(b)) {
        expect(r.x, `${tag} ${k} left`).toBeGreaterThanOrEqual(0);
        expect(r.y, `${tag} ${k} top`).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w, `${tag} ${k} right`).toBeLessThanOrEqual(l.width);
        expect(r.y + r.h, `${tag} ${k} bottom`).toBeLessThanOrEqual(l.height);
      }
      const keys = Object.keys(b);
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const a = keys[i] as string;
          const c = keys[j] as string;
          expect(overlap(b[a] as Rect, b[c] as Rect), `${tag}: ${a} × ${c}`).toBe(false);
        }
      }
    });
  });

  it('the win grows the board up to WIN_FACE_SCALE, capped only where it would reach a neighbour', () => {
    const full = new Set<string>();
    each((tag, l) => {
      const k = winScale(l, WIN_FACE_SCALE);
      expect(k, tag).toBeGreaterThanOrEqual(1);
      expect(k, tag).toBeLessThanOrEqual(WIN_FACE_SCALE);
      if (k === WIN_FACE_SCALE) full.add(l.orientation);
    });
    // every arrangement keeps the full grow where the board has room
    expect([...full].sort()).toEqual(['landscape', 'portrait', 'square']);
  });

  it('tap targets are big and apart; the snack and the queues stay readable', () => {
    each((tag, l) => {
      expect(l.hitR, tag).toBeGreaterThanOrEqual(HIT_MIN_R);
      for (let i = 1; i < l.lanes.length; i++) {
        const d = (l.lanes[i]?.x ?? 0) - (l.lanes[i - 1]?.x ?? 0);
        expect(d, `${tag} lane spacing`).toBeGreaterThanOrEqual(2 * HIT_MIN_R);
      }
      expect(Number.isInteger(l.cell), tag).toBe(true);
      expect(l.cell, `${tag} cell`).toBeGreaterThanOrEqual(22);
      expect(l.slotSize, `${tag} slot`).toBeGreaterThanOrEqual(100);
      expect(l.queueVisible, `${tag} queue`).toBeGreaterThanOrEqual(4);
      expect(l.miniSize, `${tag} mini`).toBeGreaterThanOrEqual(44);
      // the square arrangement trades snack size for the dens; the cell floor above still holds
      if (l.orientation !== 'square') {
        expect(Math.max(l.snack.w, l.snack.h), `${tag} snack`).toBeGreaterThanOrEqual(700);
      }
    });
  });
});

describe('pickDen (CLAUDE.md "Taps")', () => {
  const l = computeLayout(1080, 1920, { cols: 16, rows: 15, slots: 5, lanes: 4 });
  const shown = [6, 6, 1, 0];

  it('a point anywhere inside a front muncher is that front, even near the queue', () => {
    const f = denPoint(l, 0, 0);
    for (const dy of [0, 30, 50, l.muncherSize / 2 - 1, l.hitR - 1]) {
      expect(pickDen(l, shown, f.x, f.y + dy), `dy ${String(dy)}`).toEqual({
        kind: 'front',
        lane: 0,
        k: 0,
      });
    }
  });

  it('queued munchers below the front circle are a nope target; empty places hit nothing', () => {
    const q = denPoint(l, 1, 3);
    expect(pickDen(l, shown, q.x, q.y)).toEqual({ kind: 'behind', lane: 1, k: 3 });
    const empty = denPoint(l, 2, 1);
    expect(pickDen(l, shown, empty.x, empty.y)).toBeNull();
    const none = denPoint(l, 3, 0);
    expect(pickDen(l, shown, none.x, none.y)).toBeNull();
  });
});
