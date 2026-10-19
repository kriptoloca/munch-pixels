import Phaser from 'phaser';
import { COLOR_PAGE_CSS } from './config';
import { designSize } from './game/layout';
import { BootScene } from './game/scenes/BootScene';
import { GameScene } from './game/scenes/GameScene';
import { TitleScene } from './game/scenes/TitleScene';
import { installIosUnmute } from './platform/ios-unmute';

/**
 * Scale strategy (GDD §10, CLAUDE.md rule 5): Scale.FIT with a design size that follows the
 * viewport aspect. The short side is always 1080 design px; the long side is clamped to
 * [1080, 2400]. On viewport changes the game is resized to the new design size and every scene
 * re-runs its layout on the RESIZE event.
 */
function viewport(): { w: number; h: number } {
  const vv = window.visualViewport;
  return {
    w: Math.round(vv?.width ?? window.innerWidth),
    h: Math.round(vv?.height ?? window.innerHeight),
  };
}

// iOS Safari: make Web Audio ignore the ringer switch after the first tap.
installIosUnmute();

const first = viewport();
let current = designSize(first.w, first.h);

// Dev builds: ?renderer=canvas runs the Canvas renderer (headless CI machines have no GPU and
// crawl under SwiftShader WebGL, which starves Phaser's timers). Production is always AUTO.
const rendererParam = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('renderer')
  : null;

// Dev builds: ?fpsmin=N lowers Phaser's minimum fps (default 5), i.e. raises the per-frame delta
// cap, so timers keep wall-clock time on a GPU-less machine.
const fpsMin = import.meta.env.DEV
  ? Number(new URLSearchParams(window.location.search).get('fpsmin'))
  : NaN;

const game = new Phaser.Game({
  type: rendererParam === 'canvas' ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLOR_PAGE_CSS,
  banner: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: current.width,
    height: current.height,
  },
  // Pixel art: no smoothing on the snack and the faces.
  render: { antialias: true, pixelArt: false, roundPixels: false },
  fps: Number.isFinite(fpsMin) && fpsMin >= 1 ? { min: fpsMin } : undefined,
  scene: [BootScene, TitleScene, GameScene],
});

function onViewportChange(): void {
  const v = viewport();
  const next = designSize(v.w, v.h);
  if (next.width !== current.width || next.height !== current.height) {
    current = next;
    // setGameSize (not resize): only it updates the FIT aspect ratio of the display size.
    game.scale.setGameSize(next.width, next.height);
  } else {
    game.scale.refresh();
  }
}

window.addEventListener('resize', onViewportChange);
window.visualViewport?.addEventListener('resize', onViewportChange);
window.addEventListener('orientationchange', () => {
  // iOS reports the old size for a frame or two after rotation.
  window.setTimeout(onViewportChange, 60);
  window.setTimeout(onViewportChange, 300);
});
