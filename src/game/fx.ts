import type Phaser from 'phaser';
import {
  BITE_ARC_MIN_PX,
  BITE_ARC_SHARE,
  BITE_END_SCALE,
  BITE_LIFT_SCALE,
  BITE_LIFT_SHARE,
  CONFETTI_COUNT,
  CONFETTI_DRIFT_SHARE,
  CONFETTI_FADE_PART,
  CONFETTI_FALL_SHARE,
  CONFETTI_MS,
  CONFETTI_PX,
  CONFETTI_RISE_PART,
  CONFETTI_RISE_SHARE,
  CONFETTI_STAGGER_MS,
  CONFETTI_TURNS,
  CONFETTI_WAVES,
  CRUMB_DROP_CELLS,
  CRUMB_HOP_SHARE,
  CRUMB_MS,
  CRUMB_SIZE_SHARE,
  CRUMB_SPREAD_CELLS,
  CRUMBS_PER_BITE,
  FX_FALL_POWER,
  FX_GOLDEN_STEP,
  FX_VARY,
  PUFF_COUNT,
  PUFF_MS,
  PUFF_RISE_SHARE,
  PUFF_SIZE_SHARE,
  PUFF_START_SCALE,
} from './feel';
import { FX_POOL_CRUMBS, FX_POOL_FLIGHTS, FX_POOL_PUFFS } from '../config';
import type { Point, Rect } from './layout';

/**
 * Pooled effects on the scene clock (GDD §3a, Epic 4 task 14): bitten pixels flying into a mouth,
 * crumbs, burp puffs and the win confetti. Every piece is a plain filled shape in its own colour
 * (a fill, never a tint). The pools are created when the board is drawn and reused, so a bite
 * allocates nothing; `update` moves the live pieces from the scene clock, so a pause or a hit
 * stop (both stop that clock) freezes them.
 */
type Kind = 'flight' | 'crumb' | 'puff' | 'confetti';

/** Starting pool sizes (src/config.ts; the confetti pool holds one burst). */
const WARM: Record<Kind, number> = {
  flight: FX_POOL_FLIGHTS,
  crumb: FX_POOL_CRUMBS,
  puff: FX_POOL_PUFFS,
  confetti: CONFETTI_COUNT,
};
const KINDS: readonly Kind[] = ['flight', 'crumb', 'puff', 'confetti'];

/** One pooled piece. Plain numbers only: a launch writes into it, nothing is allocated. */
export class Piece {
  active = false;
  kind: Kind;
  t0 = 0;
  dur = 1;
  x0 = 0;
  y0 = 0;
  x1 = 0;
  y1 = 0;
  cx = 0;
  cy = 0;
  size = 1;
  spin = 0;
  /** Flights: whose mouth, the meal's last bite, squeezed (D4), the tick's pitch. */
  who = '';
  last = false;
  fast = false;
  detune = 0;

  constructor(
    kind: Kind,
    readonly obj: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc,
  ) {
    this.kind = kind;
  }
}

export interface PoolCounts {
  flight: number;
  crumb: number;
  puff: number;
  confetti: number;
  /** Pieces in flight now. */
  active: number;
  /** Pieces created beyond the warm pools since the board was drawn. */
  grown: number;
}

export class Fx {
  private readonly pools: Record<Kind, Piece[]> = { flight: [], crumb: [], puff: [], confetti: [] };
  private grown = 0;
  /** A cheap deterministic spread for crumbs and confetti (no Math.random in a replayable scene). */
  private spread = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
    /** A flight reached its mouth (called from `update` or `land`). */
    private readonly onLand: (p: Piece) => void,
  ) {}

  /** The board was drawn again (its objects were destroyed): fresh, warm pools. */
  reset(): void {
    for (const kind of Object.keys(this.pools) as Kind[]) {
      this.pools[kind].length = 0;
      for (let i = 0; i < WARM[kind]; i++) this.pools[kind].push(this.make(kind));
    }
    this.grown = 0;
  }

  /** A bitten pixel lifts from `from` and flies on an arc into `to`, shrinking. */
  flight(
    from: Point,
    to: Point,
    colour: number,
    size: number,
    t0: number,
    dur: number,
    who: string,
    last: boolean,
    fast: boolean,
    detune: number,
  ): void {
    const p = this.take('flight', colour);
    p.t0 = t0;
    p.dur = dur;
    p.x0 = from.x;
    p.y0 = from.y;
    p.x1 = to.x;
    p.y1 = to.y;
    const lift = Math.max(
      BITE_ARC_MIN_PX,
      BITE_ARC_SHARE * Math.hypot(to.x - from.x, to.y - from.y),
    );
    p.cx = (from.x + to.x) / 2;
    p.cy = Math.min(from.y, to.y) - lift;
    p.size = size;
    p.who = who;
    p.last = last;
    p.fast = fast;
    p.detune = detune;
    p.obj.setPosition(from.x, from.y).setScale(size).setAlpha(1).setVisible(true);
  }

  /** Crumbs in the pixel's colour burst where it stood. */
  crumbs(at: Point, colour: number, cell: number, t0: number): void {
    for (let i = 0; i < CRUMBS_PER_BITE; i++) {
      const p = this.take('crumb', colour);
      const side = this.next();
      p.t0 = t0;
      p.dur = CRUMB_MS;
      p.x0 = at.x;
      p.y0 = at.y;
      p.x1 = at.x + side * CRUMB_SPREAD_CELLS * cell;
      p.y1 = at.y + CRUMB_DROP_CELLS * cell * (1 - FX_VARY + FX_VARY * Math.abs(side));
      p.size = CRUMB_SIZE_SHARE * cell;
      p.obj.setPosition(at.x, at.y).setScale(p.size).setAlpha(1).setVisible(true);
    }
  }

  /** Burp puffs rise from a mouth and fade. */
  puff(at: Point, colour: number, muncherSize: number, t0: number): void {
    for (let i = 0; i < PUFF_COUNT; i++) {
      const p = this.take('puff', colour);
      const side = (i - (PUFF_COUNT - 1) / 2) / PUFF_COUNT;
      p.t0 = t0;
      p.dur = PUFF_MS;
      p.x0 = at.x + side * muncherSize * PUFF_SIZE_SHARE;
      p.y0 = at.y;
      p.x1 = p.x0 + side * muncherSize * PUFF_SIZE_SHARE * 2;
      p.y1 = at.y - PUFF_RISE_SHARE * muncherSize * (1 - Math.abs(side));
      p.size = PUFF_SIZE_SHARE * muncherSize;
      p.obj
        .setPosition(p.x0, p.y0)
        .setScale(p.size * PUFF_START_SCALE)
        .setAlpha(1)
        .setVisible(true);
    }
  }

  /** Confetti bursts up over the board and falls, in the given fill colours. */
  confetti(area: Rect, colours: readonly number[], t0: number): void {
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const p = this.take('confetti', colours[i % colours.length] as number);
      const u = (i + 0.5) / CONFETTI_COUNT;
      const mid = area.y + area.h / 2;
      p.t0 = t0 + (i % CONFETTI_WAVES) * CONFETTI_STAGGER_MS;
      p.dur = CONFETTI_MS;
      p.x0 = area.x + area.w * u;
      p.y0 = mid;
      p.x1 = p.x0 + this.next() * area.w * CONFETTI_DRIFT_SHARE;
      p.y1 = mid + area.h * CONFETTI_FALL_SHARE * (1 - FX_VARY + FX_VARY * Math.abs(this.next()));
      p.cy = mid - area.h * CONFETTI_RISE_SHARE * (1 - FX_VARY + FX_VARY * Math.abs(this.next()));
      p.size = CONFETTI_PX;
      p.spin = this.next() * CONFETTI_TURNS * 2 * Math.PI;
      p.obj.setPosition(p.x0, p.y0).setScale(p.size).setAlpha(0).setVisible(true);
    }
  }

  /** Moves every live piece to `now` (scene clock); flights that arrive land. */
  update(now: number): void {
    for (let k = 0; k < KINDS.length; k++) {
      const pool = this.pools[KINDS[k] as Kind];
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i] as Piece;
        if (p.active) this.step(p, now);
      }
    }
  }

  /** Lands every flight of a muncher at once (its meal is over: the full or a redraw). */
  land(who: string): void {
    const pool = this.pools.flight;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i] as Piece;
      if (p.active && p.who === who) this.finish(p, true);
    }
  }

  counts(): PoolCounts {
    let active = 0;
    for (const kind of KINDS) for (const p of this.pools[kind]) if (p.active) active += 1;
    return {
      flight: this.pools.flight.length,
      crumb: this.pools.crumb.length,
      puff: this.pools.puff.length,
      confetti: this.pools.confetti.length,
      active,
      grown: this.grown,
    };
  }

  private step(p: Piece, now: number): void {
    const t = Math.min(1, Math.max(0, (now - p.t0) / p.dur));
    const o = p.obj;
    switch (p.kind) {
      case 'flight': {
        // ease-in along a quadratic arc; it lifts and grows first, then shrinks into the mouth
        const e = t * t;
        const k = 1 - e;
        o.setPosition(
          k * k * p.x0 + 2 * k * e * p.cx + e * e * p.x1,
          k * k * p.y0 + 2 * k * e * p.cy + e * e * p.y1,
        );
        const s =
          t < BITE_LIFT_SHARE
            ? 1 + (BITE_LIFT_SCALE - 1) * (t / BITE_LIFT_SHARE)
            : BITE_LIFT_SCALE +
              (BITE_END_SCALE - BITE_LIFT_SCALE) * ((t - BITE_LIFT_SHARE) / (1 - BITE_LIFT_SHARE));
        o.setScale(p.size * s);
        break;
      }
      case 'crumb': {
        // out to the side, a little hop, then down, shrinking and fading
        const e = 1 - (1 - t) * (1 - t);
        const drop = p.y1 - p.y0;
        o.setPosition(
          p.x0 + (p.x1 - p.x0) * e,
          p.y0 + drop * t ** FX_FALL_POWER - drop * CRUMB_HOP_SHARE * Math.sin(Math.PI * t),
        );
        o.setScale(p.size * (1 - FX_VARY * t)).setAlpha(1 - t);
        break;
      }
      case 'puff': {
        const e = 1 - (1 - t) * (1 - t);
        o.setPosition(p.x0 + (p.x1 - p.x0) * e, p.y0 + (p.y1 - p.y0) * e);
        o.setScale(p.size * (PUFF_START_SCALE + (1 - PUFF_START_SCALE) * e)).setAlpha(1 - t);
        break;
      }
      case 'confetti': {
        if (now < p.t0) break;
        // up to its peak first, then a slow fall with a drift and a spin, fading at the end
        const rise = Math.min(1, t / CONFETTI_RISE_PART);
        const fall = Math.max(0, (t - CONFETTI_RISE_PART) / (1 - CONFETTI_RISE_PART));
        const up = 1 - (1 - rise) * (1 - rise);
        const y = p.y0 + (p.cy - p.y0) * up + (p.y1 - p.cy) * fall ** FX_FALL_POWER;
        o.setPosition(p.x0 + (p.x1 - p.x0) * t, y).setRotation(p.spin * t);
        o.setAlpha(t > 1 - CONFETTI_FADE_PART ? (1 - t) / CONFETTI_FADE_PART : 1);
        break;
      }
    }
    if (t >= 1) this.finish(p, true);
  }

  private finish(p: Piece, landed: boolean): void {
    p.active = false;
    p.obj.setVisible(false);
    if (landed && p.kind === 'flight') this.onLand(p);
  }

  private take(kind: Kind, colour: number): Piece {
    const pool = this.pools[kind];
    let p: Piece | undefined;
    for (let i = 0; i < pool.length; i++) {
      if (!(pool[i] as Piece).active) {
        p = pool[i];
        break;
      }
    }
    if (!p) {
      p = this.make(kind);
      pool.push(p);
      this.grown += 1;
    }
    p.active = true;
    p.obj.setFillStyle(colour).setRotation(0);
    return p;
  }

  private make(kind: Kind): Piece {
    const obj =
      kind === 'puff'
        ? this.scene.add.circle(0, 0, 0.5, 0xffffff)
        : this.scene.add.rectangle(0, 0, 1, 1, 0xffffff);
    obj.setDepth(this.depth).setVisible(false);
    return new Piece(kind, obj);
  }

  /** −1…1, evenly spread and repeatable (golden-ratio steps). */
  private next(): number {
    this.spread = (this.spread + FX_GOLDEN_STEP) % 1;
    return this.spread * 2 - 1;
  }
}
