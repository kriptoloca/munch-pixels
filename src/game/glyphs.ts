import type Phaser from 'phaser';

/**
 * Text-free button marks (CLAUDE.md rule 8), drawn with Graphics at a centre and a size `s`
 * (about half the button radius). Shares of `s` are named so the marks can be tuned in one place.
 */

/** Play / next: a triangle pointing right. */
const PLAY_BACK = 0.6;

export function drawPlay(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  colour: number,
): void {
  g.fillStyle(colour);
  g.fillTriangle(x - s * PLAY_BACK, y - s, x - s * PLAY_BACK, y + s, x + s, y);
}

/** Retry: an open ring from -60° round to 240°, with an arrow head at its start. */
const RING_R = 0.8;
const RING_LINE = 0.35;
const RING_FROM_DEG = -60;
const RING_TO_DEG = 240;
const HEAD_BACK = 0.45;
const HEAD_UP = 0.15;
const HEAD_TIP_X = 0.3;
const HEAD_TIP_UP = 0.45;
const HEAD_LOW_X = 0.1;
const HEAD_LOW = 0.4;

export function drawRetry(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  colour: number,
): void {
  const from = (RING_FROM_DEG * Math.PI) / 180;
  const to = (RING_TO_DEG * Math.PI) / 180;
  g.fillStyle(colour);
  g.lineStyle(s * RING_LINE, colour);
  g.beginPath();
  g.arc(x, y, s * RING_R, from, to);
  g.strokePath();
  const ax = x + s * RING_R * Math.cos(from);
  const ay = y + s * RING_R * Math.sin(from);
  g.fillTriangle(
    ax - s * HEAD_BACK,
    ay - s * HEAD_UP,
    ax + s * HEAD_TIP_X,
    ay - s * HEAD_TIP_UP,
    ax + s * HEAD_LOW_X,
    ay + s * HEAD_LOW,
  );
}
