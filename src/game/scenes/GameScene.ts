import Phaser from 'phaser';
import { installDebug, uninstallDebug } from '../../dev/debug';
import { getPlatform, markInteractive, sentPlatformMessages } from '../../platform/bridge';
import { progress } from '../state';

/** Game (GDD §9 screen 3). Epic 0 stub: shows the level number; the loop arrives in Epic 3. */
export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create(): void {
    const { width, height } = this.scale.gameSize;
    this.add
      .text(width / 2, height / 2, String(progress.level), {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '160px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    const platform = getPlatform();
    // Only the dev `?level=` shortcut reaches the Game before the Title; then this is the first
    // interactive screen.
    markInteractive(platform);
    if (import.meta.env.DEV) {
      installDebug({
        state: () => ({
          scene: 'Game',
          level: progress.level,
          platformId: platform.platformId,
          messages: [...sentPlatformMessages()],
          paused: platform.isPaused(),
        }),
        point: () => null,
      });
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        uninstallDebug();
      });
    }
  }
}
