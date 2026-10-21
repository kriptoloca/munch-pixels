import type Phaser from 'phaser';
import { COLOR_LABEL_STROKE, DIGIT_STROKE_SHARE, MUNCHER_FOOT_SHARE } from '../config';
import { BELLY_TALL_SHARE, GULP_MS, GULP_SQUASH, bellyScale } from './feel';
import type { Point } from './layout';
import {
  DIGIT_FRONT,
  DIGIT_QUEUE,
  MOUTH_AT,
  faceToneFor,
  type Expression,
  type FaceTone,
} from './muncher-art';
import { bodyKey, faceKey } from './textures';

/** Where a muncher is: the front of a den (full size), the queue behind it (small), a slot. */
export type Place = 'front' | 'queue' | 'seat';

/**
 * The transient motion the scene tweens on a muncher (the tweens target this object, so one
 * `killTweensOf` stops them all): `t` drives a hop or a waddle, `lift` raises the muncher off
 * its place (arcs, jumps, bobs), `sx`/`sy` squash it. At rest: 0, 0, 1, 1.
 */
export interface MuncherAnim {
  t: number;
  lift: number;
  sx: number;
  sy: number;
}

/**
 * A muncher on screen (GDD §4): its body texture in its own colour, a shared expression overlay
 * and its remaining appetite as a digit. Two containers: `box` carries the resting position, the
 * place scale (front or queue), the alpha and the waddle; `inner` carries the lift, the squash
 * and the belly, scaled about the feet so a landing squashes into the ground.
 */
export class MuncherView {
  readonly box: Phaser.GameObjects.Container;
  readonly anim: MuncherAnim = { t: 0, lift: 0, sx: 1, sy: 1 };
  /** The eating run in progress: its first bite latched the combo step (D1). */
  eating = false;
  runStep = 0;
  private readonly inner: Phaser.GameObjects.Container;
  private readonly face: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly tone: FaceTone;
  private readonly foot: number;
  private shown: number;
  /** Bites since it sat down (the belly). */
  private meal: number;
  private expr: Expression = 'idle';
  private where: Place;
  private gone = false;
  private belly = 1;
  /** Scene time of the last gulp (a landed pixel), −∞ when none is running. */
  private gulpAt = Number.NEGATIVE_INFINITY;
  private gulp = 1;

  constructor(
    scene: Phaser.Scene,
    paletteKey: string,
    colour: number,
    remaining: number,
    private readonly size: number,
    at: Point,
    place: Place,
    eaten = 0,
  ) {
    this.tone = faceToneFor(colour);
    this.foot = MUNCHER_FOOT_SHARE * size;
    this.shown = remaining;
    this.meal = eaten;
    this.belly = bellyScale(eaten);
    this.where = place;
    const body = scene.add.image(0, -this.foot, bodyKey(paletteKey)).setDisplaySize(size, size);
    this.face = scene.add
      .image(0, -this.foot, faceKey('idle', this.tone))
      .setDisplaySize(size, size);
    const font = Math.round(size * DIGIT_FRONT.size);
    this.label = scene.add
      .text(0, 0, String(remaining), {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${String(font)}px`,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: COLOR_LABEL_STROKE,
        strokeThickness: Math.round(font * DIGIT_STROKE_SHARE),
      })
      .setOrigin(0.5);
    this.inner = scene.add.container(0, this.foot, [body, this.face, this.label]);
    this.box = scene.add.container(at.x, at.y, [this.inner]);
    this.setPlace(place);
    this.applyAnim();
  }

  /** The appetite digit on screen. */
  get digit(): number {
    return this.shown;
  }

  get expression(): Expression {
    return this.expr;
  }

  get place(): Place {
    return this.where;
  }

  /** The front and seated munchers show their expression; the queue shows eyes and a big digit. */
  setPlace(place: Place): void {
    this.where = place;
    const queue = place === 'queue';
    const d = queue ? DIGIT_QUEUE : DIGIT_FRONT;
    this.label.setPosition(0, d.cy * this.size - this.foot).setScale(d.size / DIGIT_FRONT.size);
    this.face.setTexture(faceKey(queue ? 'queue' : this.expr, this.tone));
  }

  setFace(expr: Expression): void {
    if (expr === this.expr) return;
    this.expr = expr;
    if (this.where !== 'queue') this.face.setTexture(faceKey(expr, this.tone));
  }

  /**
   * A bite landed at scene time `now`: the digit drops, the belly swells and the muncher gulps
   * (a late flight after the leave: nothing).
   */
  eat(now: number): void {
    if (this.gone) return;
    this.shown = Math.max(0, this.shown - 1);
    this.label.setText(String(this.shown));
    this.meal += 1;
    this.belly = bellyScale(this.meal);
    this.gulpAt = now;
    this.tick(now);
  }

  /** Advances the gulp to scene time `now` (the scene calls it every frame; no allocation). */
  tick(now: number): void {
    const t = (now - this.gulpAt) / GULP_MS;
    const g = t >= 0 && t < 1 ? 1 - GULP_SQUASH * Math.sin(Math.PI * t) : 1;
    if (g === this.gulp && t >= 1) return;
    this.gulp = g;
    this.applyAnim();
  }

  /** Applies `anim` (tweens call this from their onUpdate; bound once, so it allocates nothing). */
  readonly applyAnim = (): void => {
    const tall = 1 + (this.belly - 1) * BELLY_TALL_SHARE;
    this.inner.y = this.foot - this.anim.lift;
    this.inner.setScale(this.belly * this.anim.sx, tall * this.anim.sy * this.gulp);
  };

  /** Back to rest: no lift, no squash, no waddle (the place, alpha and position stay). */
  rest(): void {
    this.anim.t = 0;
    this.anim.lift = 0;
    this.anim.sx = 1;
    this.anim.sy = 1;
    this.box.setRotation(0);
    this.applyAnim();
  }

  /** The mouth in scene coordinates (where a bitten pixel flies to), written into `out`. */
  mouth(out: Point): Point {
    const sx = this.belly * this.anim.sx;
    const sy = (1 + (this.belly - 1) * BELLY_TALL_SHARE) * this.anim.sy;
    const k = this.box.scaleX;
    out.x = this.box.x + MOUTH_AT.x * this.size * sx * k;
    out.y =
      this.box.y + (this.foot - this.anim.lift + (MOUTH_AT.y * this.size - this.foot) * sy) * k;
    return out;
  }

  /** Sum of the transient motion (the dev motion probe: unchanged while nothing moves). */
  get motion(): number {
    return this.inner.y + this.inner.scaleX + this.inner.scaleY + this.box.rotation;
  }

  destroy(): void {
    this.gone = true;
    this.box.destroy();
  }
}
