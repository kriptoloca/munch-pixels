import Phaser from 'phaser';
import type { Platform } from '../platform/bridge';
import { runLoader } from './assets';
import { MUSIC_KEY, type SfxName } from './audio-keys';
import { AUDIO_ANALYSER_FFT, AUDIO_DEBUG_HISTORY, SFX_POOL_BITE } from '../config';
import { GAIN, MUSIC_VOLUME, SFX_VOLUME, dbGain } from './feel';
import { persistProgress, progress } from './state';

/**
 * Audio (GDD §11, CLAUDE.md rule 4), ported from Peek & Find. Files come from
 * `public/audio/index.json` (scripts/audio.mjs; OGG with an M4A fallback for Safari) and load at
 * Boot, before the Title. Rules:
 *  - platform mute always wins: `platform.isAudioEnabled()` / `onAudio` gate everything; the
 *    player's toggles (progress.sound / progress.music) only narrow further;
 *  - a platform mute or pause mutes the master bus at once (an SFX already ringing included) and
 *    pauses the music; unmute and resume restore both;
 *  - nothing plays before the first gesture: SFX wait while the sound manager is locked and the
 *    music starts on the Title's play tap (`startMusic`);
 *  - every SFX plays at its feel gain (src/game/feel.ts GAIN), so success stays louder than
 *    failure as played (tests/feel.test.ts).
 * Without an index (or when a file fails) every call is a no-op.
 */
export const AUDIO_INDEX_KEY = 'audio-index';
export const AUDIO_INDEX_URL = 'audio/index.json';
/**
 * Sounds that play many times a second get a few reusable instances, played round-robin, instead
 * of a new sound object (and its audio nodes) per play: the bite tick runs 14 times a second.
 */
const POOLED: Partial<Record<SfxName, number>> = { bite: SFX_POOL_BITE };

/** Per-play options: `detune` in cents (pitch steps), `db` lifts the sound (the last bite). */
export interface SfxOptions {
  detune?: number;
  db?: number;
}
/** A play without options: one shared object, so a call allocates nothing. */
export const NO_SFX_OPTIONS: Readonly<SfxOptions> = Object.freeze({});

export interface AudioIndex {
  version: number;
  sounds: Record<string, { ogg: string; m4a: string; source: string; music: boolean }>;
  music: string;
}

export interface AudioDebug {
  ready: boolean;
  locked: boolean;
  platformEnabled: boolean;
  paused: boolean;
  musicWanted: boolean;
  musicPlaying: boolean;
  /** Last SFX keys that were actually started. */
  played: string[];
  /** SFX started since boot, in all and per sound (the e2e counts a cue across a level). */
  playedTotal: number;
  counts: Record<string, number>;
  /** SFX requests dropped by a gate (mute, pause, toggle, missing file). */
  dropped: number;
  /** RMS of the last 2048 samples on the master bus (−1 without Web Audio). Dev checks only. */
  level: number;
  /** Web Audio context state ('running', 'suspended', 'interrupted' on iOS) or 'none'. */
  contextState: string;
  /** Keys of the index that are not in the audio cache after loading (load or decode failed). */
  missing: string[];
  /** The player's toggles. */
  soundOn: boolean;
  musicOn: boolean;
}

function isIndex(raw: unknown): raw is AudioIndex {
  if (typeof raw !== 'object' || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return r.version === 1 && typeof r.sounds === 'object' && r.sounds !== null;
}

/** Keys that did not make it into the audio cache (load or decode failure). */
const missingKeys: string[] = [];

/** Loads every file of the index that is not in the audio cache yet. Boot calls this once. */
export async function loadAudio(scene: Phaser.Scene): Promise<void> {
  const raw: unknown = scene.cache.json.get(AUDIO_INDEX_KEY);
  if (!isIndex(raw)) return;
  const pending = Object.entries(raw.sounds).filter(([key]) => !scene.cache.audio.exists(key));
  if (pending.length === 0) return;
  await runLoader(scene, (loader) => {
    for (const [key, e] of pending) loader.audio(key, [e.ogg, e.m4a]);
  });
  // A decode failure is only logged by Phaser (not a FILE_LOAD_ERROR); the cache tells the truth.
  for (const [key] of pending) {
    if (!scene.cache.audio.exists(key) && !missingKeys.includes(key)) missingKeys.push(key);
  }
}

/** The gain a sound plays at, relative to the SFX volume (feel log, tests). */
export function sfxGain(name: SfxName, db = 0): number {
  return GAIN[name] * dbGain(db);
}

class AudioManager {
  private sound: Phaser.Sound.BaseSoundManager | null = null;
  private cache: Phaser.Cache.BaseCache | null = null;
  private music: Phaser.Sound.BaseSound | null = null;
  private platformEnabled = true;
  private paused = false;
  private musicWanted = false;
  private readonly played: string[] = [];
  private playedTotal = 0;
  private readonly counts: Record<string, number> = {};
  private dropped = 0;
  private unsubscribe: (() => void) | null = null;
  private unsubscribePause: (() => void) | null = null;
  private analyser: AnalyserNode | null = null;
  private levelBuf: Float32Array<ArrayBuffer> | null = null;
  /** An SFX asked for while the context was still locked; played the moment it unlocks. */
  private pendingSfx: { name: SfxName; opts: SfxOptions } | null = null;
  /** Reused sound instances (POOLED) and the next one to play, per key. */
  private readonly pools = new Map<SfxName, { sounds: Phaser.Sound.BaseSound[]; next: number }>();
  /** One play config, rewritten before each play (no object per tick). */
  private readonly playConfig: Phaser.Types.Sound.SoundConfig = { volume: 1, detune: 0 };

  /** Binds the game-wide sound manager and the platform's audio and pause state. */
  attach(scene: Phaser.Scene, platform: Platform): void {
    this.sound = scene.sound;
    this.cache = scene.cache.audio;
    this.platformEnabled = platform.isAudioEnabled();
    this.unsubscribe?.();
    this.unsubscribe = platform.onAudio((enabled) => {
      this.platformEnabled = enabled;
      this.refresh();
    });
    // A platform pause silences the audio in every scene (CLAUDE.md rule 4), the Title included.
    this.unsubscribePause?.();
    this.paused = platform.isPaused();
    this.unsubscribePause = platform.onPause((p) => {
      this.setPaused(p);
    });
    this.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
      this.refresh();
      // The tap that unlocked the context (the play tap on iOS) asked for its click before the
      // unlock resolved; play it now instead of dropping it.
      const pending = this.pendingSfx;
      this.pendingSfx = null;
      if (pending) this.play(pending.name, pending.opts);
    });
    this.refresh();
  }

  private sfxAllowed(): boolean {
    return this.sound !== null && this.platformEnabled && !this.paused && progress.sound;
  }

  private musicAllowed(): boolean {
    return (
      this.sound !== null &&
      this.platformEnabled &&
      !this.paused &&
      progress.music &&
      this.musicWanted
    );
  }

  /** Plays an SFX at its feel gain; `detune` shifts the pitch, `db` lifts it. */
  play(name: SfxName, opts: Readonly<SfxOptions> = NO_SFX_OPTIONS): void {
    if (!this.sound || !this.cache || !this.sfxAllowed()) {
      this.dropped += 1;
      return;
    }
    if (this.sound.locked) {
      // Keep the gain and pitch: a failure cue replayed at full volume would outweigh success.
      // A copy: the caller may reuse its options object (the bite tick does, every landing).
      this.pendingSfx = { name, opts: { ...opts } };
      return;
    }
    if (!this.cache.exists(name)) {
      this.dropped += 1;
      return;
    }
    this.playConfig.volume = Math.min(1, SFX_VOLUME * sfxGain(name, opts.db ?? 0));
    this.playConfig.detune = opts.detune ?? 0;
    if (this.start(name)) {
      this.playedTotal += 1;
      if (import.meta.env.DEV) {
        this.played.push(name);
        if (this.played.length > AUDIO_DEBUG_HISTORY) this.played.shift();
        this.counts[name] = (this.counts[name] ?? 0) + 1;
      }
    }
  }

  /** Starts one play of `name` with `playConfig`: from its pool, or a one-shot sound. */
  private start(name: SfxName): boolean {
    const size = POOLED[name];
    if (!this.sound || size === undefined) return this.sound?.play(name, this.playConfig) ?? false;
    let pool = this.pools.get(name);
    if (!pool) {
      const sound = this.sound;
      pool = { sounds: Array.from({ length: size }, () => sound.add(name)), next: 0 };
      this.pools.set(name, pool);
    }
    const s = pool.sounds[pool.next] as Phaser.Sound.BaseSound;
    pool.next = (pool.next + 1) % pool.sounds.length;
    return s.play(this.playConfig);
  }

  /** The first gesture happened (the Title's play tap): the loop may run from now on. */
  startMusic(): void {
    if (this.musicWanted) return;
    this.musicWanted = true;
    this.refresh();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.refresh();
  }

  /**
   * Flips a player toggle (the Title and the pause menu share this, Epics 5–6): the flag
   * persists, the manager re-reads it, and the click plays if sound is (still) on.
   */
  toggleSetting(key: 'sound' | 'music'): boolean {
    progress[key] = !progress[key];
    persistProgress();
    this.refresh();
    this.play('button');
    return progress[key];
  }

  /** Re-evaluates the platform state, the pause and the player's toggles; the platform wins. */
  refresh(): void {
    if (!this.sound || !this.cache) return;
    // Platform mute and pause silence the master bus, so an SFX already playing (the win jingle,
    // a burp) stops being heard at once instead of ringing out (CLAUDE.md rule 4).
    this.sound.mute = !this.platformEnabled || this.paused;
    if (this.musicAllowed() && !this.sound.locked) {
      if (!this.music && this.cache.exists(MUSIC_KEY)) {
        this.music = this.sound.add(MUSIC_KEY, { loop: true, volume: MUSIC_VOLUME });
      }
      if (this.music && !this.music.isPlaying) {
        if (this.music.isPaused) this.music.resume();
        else this.music.play();
      }
    } else if (this.music?.isPlaying) {
      this.music.pause();
    }
  }

  /** Signal on the master bus, so a headless test can tell "playing" from "audible". */
  level(): number {
    const m = this.sound;
    if (!(m instanceof Phaser.Sound.WebAudioSoundManager)) return -1;
    if (!this.analyser || !this.levelBuf) {
      this.analyser = m.context.createAnalyser();
      this.analyser.fftSize = AUDIO_ANALYSER_FFT;
      m.masterVolumeNode.connect(this.analyser);
      this.levelBuf = new Float32Array(this.analyser.fftSize);
    }
    this.analyser.getFloatTimeDomainData(this.levelBuf);
    let sum = 0;
    for (const v of this.levelBuf) sum += v * v;
    return Math.sqrt(sum / this.levelBuf.length);
  }

  debug(): AudioDebug {
    return {
      ready: this.sound !== null,
      locked: this.sound?.locked ?? true,
      platformEnabled: this.platformEnabled,
      paused: this.paused,
      musicWanted: this.musicWanted,
      musicPlaying: this.music?.isPlaying ?? false,
      played: [...this.played],
      playedTotal: this.playedTotal,
      counts: { ...this.counts },
      dropped: this.dropped,
      level: this.level(),
      contextState:
        this.sound instanceof Phaser.Sound.WebAudioSoundManager ? this.sound.context.state : 'none',
      missing: [...missingKeys],
      soundOn: progress.sound,
      musicOn: progress.music,
    };
  }
}

export const audio = new AudioManager();
