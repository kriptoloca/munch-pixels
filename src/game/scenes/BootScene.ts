import Phaser from 'phaser';
import { t } from '../../data/strings';
import { attachAnalyticsSink, track } from '../../platform/analytics';
import { initPlatform } from '../../platform/bridge';
import { SaveStore } from '../../platform/storage';
import { AUDIO_INDEX_KEY, AUDIO_INDEX_URL, audio, loadAudio } from '../audio';
import { ensureMuncherTextures } from '../textures';
import {
  adoptLateSave,
  attachSaveStore,
  hydrateProgress,
  persistProgress,
  progress,
  resetProgress,
} from '../state';

const BOOT_BAR_W = 360;
const BOOT_BAR_H = 10;
const COLOR_BAR_TRACK = 0x2e3650;
const COLOR_BAR_FILL = 0xf7b32b;

/**
 * Boot (GDD §9 screen 1): our own loading screen, then the Bridge (storage goes through it), the
 * save, the sounds, and the Title. GameReady is sent by the Title once it is interactive with its
 * assets in memory (CLAUDE.md rule 3).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Written by scripts/audio.mjs; without it the game runs silent.
    this.load.json(AUDIO_INDEX_KEY, AUDIO_INDEX_URL);
  }

  create(): void {
    this.showLoading();
    this.boot().catch((e: unknown) => {
      // A failed boot still shows the Title (the stub platform keeps the game playable).
      console.error('munch: boot failed', e);
      this.scene.start('Title');
    });
  }

  private showLoading(): void {
    const { width, height } = this.scale.gameSize;
    const cx = width / 2;
    const cy = height / 2;
    this.add
      .text(cx, cy - 40, t().title, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '72px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add.rectangle(cx, cy + 50, BOOT_BAR_W, BOOT_BAR_H, COLOR_BAR_TRACK);
    const fill = this.add
      .rectangle(cx - BOOT_BAR_W / 2, cy + 50, 1, BOOT_BAR_H, COLOR_BAR_FILL)
      .setOrigin(0, 0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (v: number) => {
      fill.width = Math.max(1, BOOT_BAR_W * v);
    });
  }

  private async boot(): Promise<void> {
    const platform = await initPlatform();
    attachAnalyticsSink((name) => {
      platform.sendMessage(name);
    });
    platform.sendMessage('in_game_loading_started');
    const store = new SaveStore(platform.storage);
    attachSaveStore(store);
    hydrateProgress(await store.load());
    adoptLateSave(store);
    track('session_start');

    let target = 'Title';
    if (import.meta.env.DEV) {
      const q = new URLSearchParams(window.location.search);
      if (q.get('reset') === '1') resetProgress();
      // ?level=N jumps straight into that level (dev shortcut for tests and phone checks).
      const level = Number(q.get('level'));
      if (Number.isInteger(level) && level >= 1) {
        progress.level = level;
        persistProgress();
        target = 'Game';
      }
    }
    // The sounds load before the Title, so GameReady (sent by the Title) has them in memory.
    await loadAudio(this);
    audio.attach(this, platform);
    ensureMuncherTextures(this);
    this.scene.start(target);
  }
}
