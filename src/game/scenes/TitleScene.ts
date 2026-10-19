import Phaser from 'phaser';
import { installDebug, toScreen, uninstallDebug } from '../../dev/debug';
import {
  getPlatform,
  markInteractive,
  sentPlatformMessages,
  simulatePause,
} from '../../platform/bridge';
import { ResumeGrace, bindPauseGrace } from '../resume-grace';
import { progress } from '../state';

const PLAY_RADIUS = 150;
/** The name and the play button sit at these shares of the screen height. */
const NAME_Y = 0.3;
const PLAY_Y = 0.58;
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
    const name = this.add
      .text(0, 0, 'Munch Pixels', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '96px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    const button = this.add.circle(0, 0, PLAY_RADIUS, COLOR_PLAY);
    const label = this.add
      .text(0, 0, String(progress.level), {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '120px',
        fontStyle: 'bold',
        color: COLOR_PLAY_TEXT,
      })
      .setOrigin(0.5);
    // Laid out for the current design size, and again whenever it changes (CLAUDE.md rule 5).
    const layout = (): void => {
      const { width, height } = this.scale.gameSize;
      this.play = { x: width / 2, y: height * PLAY_Y };
      name.setPosition(width / 2, height * NAME_Y);
      button.setPosition(this.play.x, this.play.y);
      label.setPosition(this.play.x, this.play.y).setText(String(progress.level));
    };
    layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, layout);

    const platform = getPlatform();
    const unsubscribe = bindPauseGrace(this.grace, platform);
    // A press must start on the button while input is on: a press held through a pause and
    // released after the grace never counts (CLAUDE.md rule 4; audit 2026-10-19).
    const onPlay = (p: Phaser.Input.Pointer): boolean =>
      Phaser.Math.Distance.Between(p.x, p.y, this.play.x, this.play.y) <= PLAY_RADIUS;
    let pressed = false;
    const offPress = platform.onPause((paused) => {
      if (paused) pressed = false;
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      pressed = onPlay(p);
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      const go = pressed && onPlay(p);
      pressed = false;
      if (go) this.scene.start('Game', {});
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, layout);
      unsubscribe();
      offPress();
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
        pause: simulatePause,
      });
    }
    markInteractive(platform);
  }
}
