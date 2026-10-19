import { hostedByYoutube } from './host';
/**
 * iOS Safari plays Web Audio through the "ambient" audio session, which the ringer (silent)
 * switch mutes; the moment any HTMLMediaElement plays, WebKit moves the page to the "playback"
 * session and Web Audio becomes audible regardless of the switch. This installs that trick:
 * on the first touch/click a looping, silent WAV (built in memory, no file, no network) starts
 * in an <audio> element. Nothing happens on other platforms. Inside the YouTube app the host
 * owns the audio session, so this only matters for Safari tests (GDD §12 "audio works on
 * iPhone Safari after first tap").
 */
const SAMPLE_RATE = 8000;
const SECONDS = 0.1;

function silentWavUrl(): string {
  const samples = Math.round(SAMPLE_RATE * SECONDS);
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const str = (o: number, s: string): void => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, SAMPLE_RATE, true);
  v.setUint32(28, SAMPLE_RATE, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true); // 8-bit: 128 = silence
  str(36, 'data');
  v.setUint32(40, samples, true);
  new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export function isIosLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export interface IosUnmuteState {
  /** False on every non-iOS device: nothing is installed there. */
  ios: boolean;
  /** 'none' before the first gesture, then 'playing' (session switched) or 'paused'. */
  element: 'none' | 'playing' | 'paused';
  /** Message of the last rejected play(), if any (autoplay refusal, decode problem). */
  lastError: string;
  /** Gestures seen so far. */
  kicks: number;
}

const state: IosUnmuteState = { ios: false, element: 'none', lastError: '', kicks: 0 };

/** Dev diagnostics (`?audiodebug=1`): what the silent-loop trick is doing. */
export function iosUnmuteState(): IosUnmuteState {
  return { ...state };
}

/** Idempotent; call once at startup. */
export function installIosUnmute(): void {
  // Inside the YouTube app the host owns the audio session; the trick is for Safari tests only.
  if (typeof document === 'undefined' || !isIosLike() || hostedByYoutube()) return;
  state.ios = true;
  let el: HTMLAudioElement | null = null;
  const kick = (): void => {
    state.kicks += 1;
    if (!el) {
      el = document.createElement('audio');
      el.src = silentWavUrl();
      el.loop = true;
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
    }
    const a = el;
    if (a.paused) {
      a.play()
        .then(() => {
          state.element = a.paused ? 'paused' : 'playing';
        })
        .catch((e: unknown) => {
          /* not allowed yet: the next gesture tries again */
          state.element = 'paused';
          state.lastError = e instanceof Error ? e.message : String(e);
        });
    } else {
      state.element = 'playing';
    }
  };
  document.addEventListener('touchend', kick, { passive: true });
  document.addEventListener('click', kick, { passive: true });
}
