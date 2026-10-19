import Phaser from 'phaser';
import { installDebug, toScreen, uninstallDebug } from '../../dev/debug';
import { getPlatform, markInteractive, sentPlatformMessages } from '../../platform/bridge';
import { ResumeGrace, bindPauseGrace } from '../resume-grace';
import { progress } from '../state';

const PLAY_RADIUS = 150;
const COLOR_PLAY = 0xf7b32b;
const COLOR_PLAY_TEXT = '#1b1f2a';

/**
 * Title (GDD §9 screen 2): the game's name and a big play button with the level number. It sends
 * GameReady once it is drawn and interactive (CLAUDE.md rule 3). The full Title (muncher idle,
 * toggles, brand) arrives in Epic 6.
 */
export class TitleScene extends Phaser.Scene {
  private readonly grace = new ResumeGrace(this);
  private play: { x: number; y: number } = { x: 0, y: 0 };

  constructor() {
    super('Title');
  }

  create(): void {
    const { width, height } = this.scale.gameSize;
    this.play = { x: width / 2, y: height * 0.58 };
    this.add
      .text(width / 2, height * 0.3, 'Munch Pixels', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '96px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add.circle(this.play.x, this.play.y, PLAY_RADIUS, COLOR_PLAY);
    this.add
      .text(this.play.x, this.play.y, String(progress.level), {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '120px',
        fontStyle: 'bold',
        color: COLOR_PLAY_TEXT,
      })
      .setOrigin(0.5);

    const platform = getPlatform();
    const unsubscribe = bindPauseGrace(this.grace, platform);
    // A press must start on the button while input is on: a press held through a pause and
    // released after the grace never counts (CLAUDE.md rule 4; audit 2026-10-19).
    const onPlay = (p: Phaser.Input.Pointer): boolean =>
      Phaser.Math.Distance.Between(p.x, p.y, this.play.x, this.play.y) <= PLAY_RADIUS;
    let pressed = false;
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      pressed = onPlay(p);
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      const go = pressed && onPlay(p);
      pressed = false;
      if (go) this.scene.start('Game');
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribe();
      this.grace.dispose();
      if (import.meta.env.DEV) uninstallDebug();
    });

    if (import.meta.env.DEV) {
      installDebug({
        state: () => ({
          scene: 'Title',
          level: progress.level,
          platformId: platform.platformId,
          messages: [...sentPlatformMessages()],
          paused: platform.isPaused(),
        }),
        point: (name) =>
          name === 'play'
            ? toScreen(this.game.canvas, this.scale.gameSize.width, this.play.x, this.play.y)
            : null,
      });
    }
    markInteractive(platform);
  }
}
