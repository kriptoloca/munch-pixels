import type Phaser from 'phaser';
import { COLOR_MUNCHER_RING, MUNCHER_TEX_PX } from '../config';
import { PALETTE } from '../data/palette';
import {
  EXPRESSIONS,
  LID_FILL,
  muncherBody,
  muncherFace,
  type Expression,
  type FaceTone,
  type PathCmd,
  type Prim,
} from './muncher-art';

/**
 * Muncher textures (GDD §4): drawn once at Boot from the pure shapes of muncher-art.ts, one body
 * per palette colour (no runtime tint, CLAUDE.md "Rendering") and one overlay per expression
 * and tone, shared by every colour.
 */
export function bodyKey(paletteKey: string): string {
  return `muncher-body-${paletteKey}`;
}

export function faceKey(expr: Expression, tone: FaceTone): string {
  return `muncher-face-${expr}-${tone}`;
}

const TONES: readonly FaceTone[] = ['light', 'dark'];

function css(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

function tracePath(ctx: CanvasRenderingContext2D, d: readonly PathCmd[], s: number): void {
  const u = (v: number): number => (v + 0.5) * s;
  ctx.beginPath();
  for (const c of d) {
    switch (c[0]) {
      case 'M':
        ctx.moveTo(u(c[1]), u(c[2]));
        break;
      case 'L':
        ctx.lineTo(u(c[1]), u(c[2]));
        break;
      case 'Q':
        ctx.quadraticCurveTo(u(c[1]), u(c[2]), u(c[3]), u(c[4]));
        break;
      case 'Z':
        ctx.closePath();
        break;
    }
  }
}

/** Paints shapes into an `s`-pixel box. A lid band cuts the overlay away (the body shows). */
export function drawPrims(ctx: CanvasRenderingContext2D, prims: readonly Prim[], s: number): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const p of prims) {
    if (p.kind === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(
        (p.cx + 0.5) * s,
        (p.cy + 0.5) * s,
        p.rx * s,
        p.ry * s,
        p.rot ?? 0,
        0,
        2 * Math.PI,
      );
    } else {
      tracePath(ctx, p.d, s);
    }
    if (p.fill !== undefined) {
      if (p.fill === LID_FILL) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000000';
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.fillStyle = css(p.fill);
        ctx.fill();
      }
    }
    if (p.stroke !== undefined) {
      ctx.strokeStyle = css(p.stroke);
      ctx.lineWidth = (p.width ?? 0) * s;
      ctx.stroke();
    }
  }
}

function paint(scene: Phaser.Scene, key: string, prims: readonly Prim[]): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, MUNCHER_TEX_PX, MUNCHER_TEX_PX);
  if (!tex) return;
  drawPrims(tex.getContext(), prims, MUNCHER_TEX_PX);
  tex.refresh();
}

/** Every body and overlay texture; Boot calls this once (later calls find them in place). */
export function ensureMuncherTextures(scene: Phaser.Scene): void {
  for (const [key, colour] of Object.entries(PALETTE)) {
    paint(scene, bodyKey(key), muncherBody(colour, COLOR_MUNCHER_RING));
  }
  for (const expr of EXPRESSIONS) {
    for (const tone of TONES) paint(scene, faceKey(expr, tone), muncherFace(expr, tone));
  }
}
