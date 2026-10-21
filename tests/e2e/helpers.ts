import { expect, test as base, type Page } from '@playwright/test';
import type { MunchDebugState } from '../../src/dev/debug';

/** Published path of the development-mode build (dev shortcuts, debug hooks). */
export const TEST = 'test/';
/**
 * Flows that wait on Phaser timers run on the Canvas renderer: CI machines have no GPU and
 * SwiftShader WebGL drops to a few fps, where Phaser caps the delta per frame and its clock falls
 * behind the wall clock (lesson from Peek & Find).
 */
export const CANVAS = '&renderer=canvas';

export interface Collected {
  errors: string[];
  origins: Set<string>;
}

/** Records page errors, console errors/warnings and every request's origin. */
export function collect(page: Page): Collected {
  const c: Collected = { errors: [], origins: new Set() };
  page.on('pageerror', (e) => c.errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      c.errors.push(`${m.type()}: ${m.text().slice(0, 200)}`);
    }
  });
  page.on('request', (r) => {
    c.origins.add(new URL(r.url()).origin);
  });
  page.on('websocket', (ws) => c.errors.push(`websocket: ${ws.url()}`));
  page.on('requestfailed', (r) => {
    // a navigation cancels the previous page's requests; that is not a failed asset
    if (r.failure()?.errorText === 'net::ERR_ABORTED') return;
    c.errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText ?? ''}`);
  });
  return c;
}

/**
 * Every test gets the collector and ends with the same-origin (CLAUDE.md rule 1) and no-error
 * checks, so a stray request or console error fails whichever test caused it.
 */
export const test = base.extend<{ guard: Collected }>({
  guard: [
    async ({ page, baseURL }, use) => {
      const c = collect(page);
      await use(c);
      const origin = new URL(baseURL ?? 'http://127.0.0.1:4173/').origin;
      expect([...c.origins].filter((o) => o !== origin)).toEqual([]);
      expect(c.errors).toEqual([]);
    },
    { auto: true },
  ],
});

export function state(page: Page): Promise<MunchDebugState | undefined> {
  return page.evaluate(() => window.__munchDebug?.state());
}

/** Polls the dev state until `pred` holds (Phaser's clock lags headless, so poll, never sleep). */
export async function waitState(
  page: Page,
  pred: (s: MunchDebugState) => boolean,
  label: string,
  timeout = 40_000,
): Promise<MunchDebugState> {
  const t0 = Date.now();
  for (;;) {
    const s = await state(page);
    if (s && pred(s)) return s;
    if (Date.now() - t0 > timeout) {
      throw new Error(`timeout waiting for ${label}: ${JSON.stringify(s)}`);
    }
    await page.waitForTimeout(100);
  }
}

/** Taps a named point of the current scene (`__munchDebug.point`). */
export async function tapPoint(page: Page, name: string): Promise<void> {
  const p = await page.evaluate((n) => window.__munchDebug?.point(n) ?? null, name);
  if (!p) throw new Error(`${name}: no such point on screen`);
  await page.mouse.click(p.x, p.y);
}

/**
 * Flips the SDK's own audio state (what the YouTube adapter's onAudioEnabledChange feeds), so
 * "platform mute wins" is tested without a pause. Reaches into the pinned Bridge 2.3.1 runtime
 * (Peek & Find helpers.ts).
 */
export async function setSdkAudio(page: Page, enabled: boolean): Promise<void> {
  await page.evaluate((on) => {
    const w = window as unknown as {
      bridge: { platform: { _platformBridge: { _setAudioState: (v: boolean) => void } } };
    };
    w.bridge.platform._platformBridge._setAudioState(on);
  }, enabled);
}
