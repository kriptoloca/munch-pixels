import { expect, type Page } from '@playwright/test';
import { CANVAS, TEST, setSdkAudio, state, tapPoint, test, waitState } from './helpers';

/**
 * Audio from the player's side (GDD §11, CLAUDE.md rule 4): nothing plays before the first tap,
 * the music starts on the Title's play tap with a real signal on the master bus, taps play their
 * sounds, and a platform mute or pause silences a sound that is already playing. The host-page
 * paths (visibility, iframe) arrive with Epic 5 (platform.spec).
 */

/** Polls the RMS of the master bus (`audio.level`, −1 without Web Audio). */
async function waitLevel(
  page: Page,
  pred: (level: number) => boolean,
  label: string,
  timeout = 15_000,
): Promise<number> {
  const t0 = Date.now();
  for (;;) {
    const level = (await state(page))?.audio?.level ?? -1;
    if (pred(level)) return level;
    if (Date.now() - t0 > timeout) throw new Error(`timeout: ${label} (level ${String(level)})`);
    await page.waitForTimeout(100);
  }
}

test("silent before the first tap; music after the Title's play tap, SFX on taps", async ({
  page,
}) => {
  await page.goto(`${TEST}?reset=1${CANVAS}`, { waitUntil: 'load' });
  await waitState(page, (s) => s.scene === 'Title', 'title');
  await page.waitForTimeout(800);
  // Headless Chromium starts the context unlocked (autoplay policy), so "locked" is not asserted:
  // what matters to the player is that nothing plays before the first tap.
  const before = (await state(page))?.audio;
  expect(before?.ready).toBe(true);
  expect(before?.missing).toEqual([]);
  expect(before?.musicPlaying).toBe(false);
  expect(before?.played).toEqual([]);
  expect(before?.level ?? 1).toBeLessThan(0.0005);

  await tapPoint(page, 'play');
  const game = await waitState(
    page,
    (s) => s.scene === 'Game' && s.game?.inputOpen === true,
    'the game after the play tap',
  );
  expect(game.audio?.musicWanted).toBe(true);
  expect(game.audio?.musicPlaying).toBe(true);
  expect(game.audio?.played).toContain('button');
  await waitLevel(page, (l) => l > 0.002, 'signal on the master bus');
});

/** Level 1 by its solution, each tap once the cascade drained, up to the win jingle. */
async function playToTheJingle(page: Page, act: 'mute' | 'pause'): Promise<void> {
  await page.goto(`${TEST}?reset=1&level=1${CANVAS}&fpsmin=1`, { waitUntil: 'load' });
  const s = await waitState(page, (x) => x.game?.inputOpen === true, 'level 1');
  for (const lane of s.game?.solution ?? []) {
    await tapPoint(page, `lane:${String(lane)}`);
    await waitState(page, (x) => x.game?.pending === 0 || x.game?.panel === 'win', 'drained');
  }
  // the jingle (0.92 s) starts with the win; mute or pause in the frame that logs it
  await page.waitForFunction(
    (how) => {
      const d = window.__munchDebug;
      if (!d?.state().game?.feel.some((e) => e.kind === 'win')) return false;
      if (how === 'pause') d.pause?.(true);
      else {
        const w = window as unknown as {
          bridge: { platform: { _platformBridge: { _setAudioState: (v: boolean) => void } } };
        };
        w.bridge.platform._platformBridge._setAudioState(false);
      }
      return true;
    },
    act,
    { polling: 'raf', timeout: 30_000 },
  );
}

for (const act of ['mute', 'pause'] as const) {
  test(`a platform ${act} silences the win jingle already playing (CLAUDE.md rule 4)`, async ({
    page,
  }) => {
    await playToTheJingle(page, act);
    // well inside the 0.92 s jingle: nothing reaches the master bus any more
    await page.waitForTimeout(150);
    const level = (await state(page))?.audio?.level ?? 1;
    expect(level).toBeLessThan(0.0005);
    expect((await state(page))?.audio?.counts.win).toBe(1);
    if (act === 'mute') await setSdkAudio(page, true);
    else await page.evaluate(() => window.__munchDebug?.pause?.(false));
    await waitLevel(page, (l) => l > 0.002, 'the music is back');
  });
}
