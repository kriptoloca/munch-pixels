import type { FeelSound } from './feel';

/**
 * Audio keys (GDD §11). Phaser-free so tests and the scenes can name sounds. Every sound effect
 * has its gain and its measured file level in src/game/feel.ts (tests/audio.test.ts keeps the
 * manifest, the synth, these keys and the gains in step).
 */
export const SFX_NAMES = [
  'hop',
  'bite',
  'burp',
  'perk',
  'wait',
  'nope',
  'win',
  'stuck',
  'pop',
  'undo',
  'button',
] as const satisfies readonly FeelSound[];

export type SfxName = (typeof SFX_NAMES)[number];

export const MUSIC_KEY = 'music_loop';
