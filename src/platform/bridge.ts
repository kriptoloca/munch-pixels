import bridge, {
  EVENT_NAME,
  INTERSTITIAL_STATE,
  PLATFORM_MESSAGE,
  REWARDED_STATE,
} from '@playgama/bridge';
import { hostedByYoutube } from './host';
import { LocalStorageBackend, type StorageBackend } from './storage';
import { withTimeout } from './timeout';

/**
 * Thin wrapper over Playgama Bridge 2.3.1 (docs/bridge-notes.md lists every SDK name used and
 * where it comes from). Everything here degrades to a stub: no runtime, failed or slow
 * initialisation, unsupported ads → the game stays fully playable (CLAUDE.md rule 6).
 */

export type PlatformMessageName =
  | 'game_ready'
  | 'in_game_loading_started'
  | 'in_game_loading_stopped'
  | 'gameplay_started'
  | 'gameplay_stopped'
  | 'level_started'
  | 'level_completed'
  | 'level_failed';

/** Rewarded boosters (GDD §7): one more waiting slot, or undo the last tap. */
export type RewardedPlacement = 'slot' | 'undo';

export interface Platform {
  readonly platformId: string;
  readonly interstitialSupported: boolean;
  readonly rewardedSupported: boolean;
  readonly storage: StorageBackend;
  readonly language: string;
  isAudioEnabled(): boolean;
  isPaused(): boolean;
  /** Fire-and-forget lifecycle message; `game_ready` is sent at most once. */
  sendMessage(name: PlatformMessageName): void;
  /** Resolves when the ad closed or failed; never rejects. */
  showInterstitial(): Promise<void>;
  /** Resolves true when the reward was earned; never rejects. */
  showRewarded(placement: RewardedPlacement): Promise<boolean>;
  onPause(cb: (paused: boolean) => void): () => void;
  onAudio(cb: (enabled: boolean) => void): () => void;
}

/** CLAUDE.md rule 6: second guard next to our own AdGate. */
export const BRIDGE_MIN_INTERSTITIAL_DELAY_S = 120;
const INIT_TIMEOUT_MS = 6000;
/**
 * Inside the YouTube host the SDK waits for the host's own handshake; a 6 s cut-off would drop
 * the game to the stub and GameReady would never reach YouTube. Wait much longer there.
 */
const INIT_TIMEOUT_YOUTUBE_MS = 60_000;
/** If the SDK emits no state after a show() call, give up waiting after this long. */
const AD_SILENT_TIMEOUT_MS = 4000;
/** Upper bound for an open ad; real ads end long before. */
const AD_MAX_MS = 120_000;
const FAKE_AD_MS = 1500;
/**
 * Bridge 2.3.1 pauses the game on window `blur` and resumes it on `focus`: PlatformBridgeBase
 * feeds the "visibility" input of its pause aggregator from visibilitychange, blur and focus
 * (the YouTube bridge opts out, `isPlatformPageVisibilityApiAllowed` false). In the Playgama
 * host an ad in the parent page blurs the game's window, and focus only returns with the next
 * tap inside the game: that tap resumes the game and, on iOS Safari, reaches Phaser after the
 * resume, so it counted as a game tap (Peek & Find sandbox report 2026-10-18). Two
 * measures: the game asks for focus back when an ad ends (`regainFocus`, below), and the scene
 * input stays off for a grace after every resume (src/game/resume-grace.ts). A cross-origin
 * host may refuse the focus request; then the dim stays until the first tap, which is free.
 */

let loadingStopped = false;

/**
 * The first interactive screen is up (CLAUDE.md rule 3): closes the loading phase and sends
 * GameReady, each exactly once per page, whichever scene gets there first (the Title, or the Game
 * through the dev `?level=` shortcut). Later visits to the Title send nothing.
 */
export function markInteractive(p: Platform): void {
  if (!loadingStopped) {
    loadingStopped = true;
    p.sendMessage('in_game_loading_stopped');
  }
  p.sendMessage('game_ready');
}

/** Asks the host for focus back; a no-op where the window already has it. Never throws. */
export function regainFocus(): void {
  try {
    if (document.hasFocus()) return;
    window.focus();
  } catch {
    // not fatal: the next tap brings focus back, and the grace keeps it from counting
  }
}

const MESSAGE: Record<PlatformMessageName, string> = {
  game_ready: PLATFORM_MESSAGE.GAME_READY,
  in_game_loading_started: PLATFORM_MESSAGE.IN_GAME_LOADING_STARTED,
  in_game_loading_stopped: PLATFORM_MESSAGE.IN_GAME_LOADING_STOPPED,
  gameplay_started: PLATFORM_MESSAGE.GAMEPLAY_STARTED,
  gameplay_stopped: PLATFORM_MESSAGE.GAMEPLAY_STOPPED,
  level_started: PLATFORM_MESSAGE.LEVEL_STARTED,
  level_completed: PLATFORM_MESSAGE.LEVEL_COMPLETED,
  level_failed: PLATFORM_MESSAGE.LEVEL_FAILED,
};

let platformPromise: Promise<Platform> | null = null;
let current: Platform | null = null;
let gameReadySent = false;

function runtimePresent(): boolean {
  return typeof window !== 'undefined' && typeof window.bridge !== 'undefined';
}

/** Initialises the SDK once and resolves to the platform (or the stub). Never rejects. */
export function initPlatform(): Promise<Platform> {
  if (!platformPromise) {
    platformPromise = create().then((p) => {
      current = p;
      return p;
    });
  }
  return platformPromise;
}

/** The platform after initPlatform() resolved; a stub before that. */
export function getPlatform(): Platform {
  if (!current) current = stubPlatform(false);
  return current;
}

async function create(): Promise<Platform> {
  const fake =
    import.meta.env.DEV && new URLSearchParams(window.location.search).get('fakeads') === '1';
  if (!runtimePresent()) return stubPlatform(fake);
  try {
    await withTimeout(
      bridge.initialize(),
      hostedByYoutube() ? INIT_TIMEOUT_YOUTUBE_MS : INIT_TIMEOUT_MS,
    );
  } catch {
    return stubPlatform(fake);
  }
  try {
    bridge.advertisement.setMinimumDelayBetweenInterstitial(BRIDGE_MIN_INTERSTITIAL_DELAY_S);
  } catch {
    // not fatal
  }
  const real = realPlatform();
  if (fake && !real.interstitialSupported) return withFakeAds(real);
  return real;
}

// ---- real SDK ---------------------------------------------------------------------------------

class BridgeStorageBackend implements StorageBackend {
  async get(key: string): Promise<string | null> {
    try {
      const v: unknown = await bridge.storage.get(key, false);
      if (v === null || v === undefined || v === '') return null;
      return typeof v === 'string' ? v : JSON.stringify(v);
    } catch {
      return null;
    }
  }
  async set(key: string, value: string): Promise<void> {
    try {
      await bridge.storage.set(key, value);
    } catch {
      // best effort; the SDK already tried its local fallback
    }
  }
}

function waitForAdEnd(
  eventName: string,
  isEnd: (state: unknown) => boolean,
  onState: (state: unknown) => void,
  trigger: () => void,
): Promise<void> {
  return new Promise<void>((resolve) => {
    let finished = false;
    let silent: number | null = null;
    let max = 0;
    const handler = (state: unknown): void => {
      if (silent !== null) {
        window.clearTimeout(silent);
        silent = null;
      }
      onState(state);
      if (isEnd(state)) finish();
    };
    const finish = (): void => {
      if (finished) return;
      finished = true;
      if (silent !== null) window.clearTimeout(silent);
      window.clearTimeout(max);
      bridge.off(eventName, handler);
      resolve();
    };
    max = window.setTimeout(finish, AD_MAX_MS);
    bridge.on(eventName, handler);
    // No state at all shortly after the call means the SDK declined (e.g. its own delay guard).
    silent = window.setTimeout(finish, AD_SILENT_TIMEOUT_MS);
    try {
      trigger();
    } catch {
      finish();
    }
  });
}

function realPlatform(): Platform {
  const storage = new BridgeStorageBackend();
  let interstitialSupported = false;
  let rewardedSupported = false;
  let platformId = 'unknown';
  let language = 'en';
  try {
    interstitialSupported = bridge.advertisement.isInterstitialSupported;
    rewardedSupported = bridge.advertisement.isRewardedSupported;
    platformId = String(bridge.platform.id);
    language = String(bridge.platform.language || 'en');
  } catch {
    // keep defaults
  }
  return {
    platformId,
    interstitialSupported,
    rewardedSupported,
    storage,
    language,
    isAudioEnabled: () => {
      try {
        return bridge.platform.isAudioEnabled;
      } catch {
        return true;
      }
    },
    isPaused: () => {
      try {
        return bridge.platform.isPaused;
      } catch {
        return false;
      }
    },
    sendMessage: (name) => {
      if (name === 'game_ready') {
        if (gameReadySent) return;
        gameReadySent = true;
      }
      sent.push(name);
      try {
        void bridge.platform.sendMessage(MESSAGE[name]).catch(() => undefined);
      } catch {
        // ignore
      }
    },
    showInterstitial: () => {
      if (!interstitialSupported) return Promise.resolve();
      return waitForAdEnd(
        EVENT_NAME.INTERSTITIAL_STATE_CHANGED,
        (s) => s === INTERSTITIAL_STATE.CLOSED || s === INTERSTITIAL_STATE.FAILED,
        () => undefined,
        () => {
          bridge.advertisement.showInterstitial();
        },
      );
    },
    showRewarded: (placement) => {
      if (!rewardedSupported) return Promise.resolve(false);
      let earned = false;
      return waitForAdEnd(
        EVENT_NAME.REWARDED_STATE_CHANGED,
        (s) => s === REWARDED_STATE.CLOSED || s === REWARDED_STATE.FAILED,
        (s) => {
          if (s === REWARDED_STATE.REWARDED) earned = true;
        },
        () => {
          bridge.advertisement.showRewarded(placement);
        },
      ).then(() => earned);
    },
    onPause: (cb) =>
      subscribe(EVENT_NAME.PAUSE_STATE_CHANGED, (v) => {
        cb(Boolean(v));
      }),
    onAudio: (cb) =>
      subscribe(EVENT_NAME.AUDIO_STATE_CHANGED, (v) => {
        cb(Boolean(v));
      }),
  };
}

function subscribe(eventName: string, cb: (v: unknown) => void): () => void {
  try {
    bridge.on(eventName, cb);
  } catch {
    return () => undefined;
  }
  return () => {
    try {
      bridge.off(eventName, cb);
    } catch {
      // ignore
    }
  };
}

// ---- stub (no runtime / init failed) and dev fake ads ----------------------------------------

/** Every lifecycle message sent to the platform, in order (dev checks: GameReady timing). */
const sent: PlatformMessageName[] = [];

export function sentPlatformMessages(): readonly PlatformMessageName[] {
  return sent;
}

function stubPlatform(fake: boolean): Platform {
  const base: Platform = {
    platformId: 'none',
    interstitialSupported: false,
    rewardedSupported: false,
    storage: new LocalStorageBackend(),
    language: 'en',
    isAudioEnabled: () => true,
    isPaused: () => false,
    sendMessage: (name) => {
      if (name === 'game_ready') {
        if (gameReadySent) return;
        gameReadySent = true;
      }
      sent.push(name);
    },
    showInterstitial: () => Promise.resolve(),
    showRewarded: () => Promise.resolve(false),
    onPause: () => () => undefined,
    onAudio: () => () => undefined,
  };
  return fake ? withFakeAds(base) : base;
}

/** Dev only (?fakeads=1): a DOM overlay stands in for an ad so the flows can be exercised. */
function withFakeAds(p: Platform): Platform {
  const show = (label: string): Promise<void> =>
    new Promise<void>((resolve) => {
      const el = document.createElement('div');
      el.id = 'fake-ad';
      el.textContent = label;
      el.setAttribute(
        'style',
        // pointer-events:none: taps reach the canvas, so the game's own ad guard is what blocks
        // them (a real ad does not sit in our DOM either).
        'position:fixed;inset:0;background:#000c;color:#fff;display:flex;align-items:center;' +
          'justify-content:center;font:bold 48px sans-serif;z-index:99999;pointer-events:none',
      );
      document.body.appendChild(el);
      window.setTimeout(() => {
        el.remove();
        resolve();
      }, FAKE_AD_MS);
    });
  return {
    ...p,
    platformId: `${p.platformId}+fakeads`,
    interstitialSupported: true,
    rewardedSupported: true,
    showInterstitial: () => show('AD'),
    showRewarded: (placement) => show(`REWARD: ${placement}`).then(() => true),
  };
}
