import { expect, type Page } from '@playwright/test';
import { CANVAS, TEST, tapPoint, test, waitState } from './helpers';

/** Epic 3 (M1): a level is playable from start to win or loss through real taps. */

/** Waits until the timeline has settled and the screen tells the rules' truth. */
async function expectScreenTrue(page: Page, label: string): Promise<void> {
  const s = await waitState(
    page,
    (x) => x.game?.pending === 0 && x.game.mismatches.length === 0,
    `${label}: screen matches the rules`,
    15_000,
  ).catch(async (e: unknown) => {
    const now = await page.evaluate(() => window.__munchDebug?.state().game?.mismatches);
    throw new Error(`${String(e)}\nmismatches: ${JSON.stringify(now)}`);
  });
  expect(s.game?.mismatches).toEqual([]);
}

async function playSolution(page: Page): Promise<void> {
  const s = await waitState(page, (x) => x.game?.inputOpen === true, 'playing');
  for (const lane of s.game?.solution ?? []) await tapPoint(page, `lane:${String(lane)}`);
}

function savedLevel(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('munch-pixels:save');
    return raw ? (JSON.parse(raw) as { level: number }).level : null;
  });
}

test('level 1 by its stored solution → win panel → next → level 2, saved', async ({ page }) => {
  await page.goto(`${TEST}?reset=1&level=1${CANVAS}`, { waitUntil: 'load' });
  await playSolution(page);
  const won = await waitState(page, (s) => s.game?.panelReady === true, 'win panel');
  expect(won.game?.panel).toBe('win');
  expect(won.game?.status).toBe('won');
  expect(won.game?.savedLevel).toBe(2);
  expect(won.game?.levelsCompleted).toBe(1);
  expect(won.messages).toContain('level_completed');
  await expect.poll(() => savedLevel(page)).toBe(2);
  await tapPoint(page, 'next');
  const next = await waitState(
    page,
    (s) => s.level === 2 && s.game?.inputOpen === true && s.game.taps === 0,
    'level 2',
  );
  expect(next.messages.filter((m) => m === 'level_started')).toHaveLength(2);
});

test('a losing order → lose panel → retry restarts the same level', async ({ page }) => {
  await page.goto(`${TEST}?reset=1&level=20${CANVAS}`, { waitUntil: 'load' });
  await waitState(page, (s) => s.game?.inputOpen === true, 'playing');
  const taps = await page.evaluate(() => window.__munchDebug?.losingTaps?.() ?? null);
  expect(taps).not.toBeNull();
  for (const lane of taps ?? []) await tapPoint(page, `lane:${String(lane)}`);
  const lost = await waitState(
    page,
    (s) => s.game?.panel === 'lose' && s.game.panelReady,
    'lose panel',
  );
  expect(lost.game?.status).toBe('lost');
  expect(lost.game?.savedLevel).toBe(20);
  expect(lost.messages).toContain('level_failed');
  await tapPoint(page, 'retry');
  await waitState(
    page,
    (s) => s.level === 20 && s.game?.inputOpen === true && s.game.taps === 0,
    'retry',
  );
});

test('a tap on a muncher behind the front is a nope: nothing moves', async ({ page }) => {
  await page.goto(`${TEST}?reset=1&level=20${CANVAS}`, { waitUntil: 'load' });
  const before = await waitState(page, (s) => s.game?.inputOpen === true, 'playing');
  await tapPoint(page, 'behind:0');
  const after = await waitState(page, (s) => (s.game?.nopes ?? 0) === 1, 'nope');
  expect(after.game?.taps).toBe(0);
  expect(after.game?.fronts).toEqual(before.game?.fronts);
});

for (const [name, width, height] of [
  ['1:1', 800, 800],
  ['16:9', 1280, 720],
] as const) {
  test(`level 1 plays to the win in ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(`${TEST}?reset=1&level=1${CANVAS}`, { waitUntil: 'load' });
    await playSolution(page);
    await waitState(page, (s) => s.game?.panel === 'win', 'win panel');
  });
}

test('turning the phone mid-level redraws the board from the rules and play goes on', async ({
  page,
}) => {
  await page.goto(`${TEST}?reset=1&level=2${CANVAS}`, { waitUntil: 'load' });
  const s = await waitState(page, (x) => x.game?.inputOpen === true, 'playing');
  const solution = s.game?.solution ?? [];
  const half = Math.floor(solution.length / 2);
  for (const lane of solution.slice(0, half)) await tapPoint(page, `lane:${String(lane)}`);
  await page.setViewportSize({ width: 844, height: 390 });
  await waitState(page, (x) => x.game?.pending === 0, 'flushed');
  for (const lane of solution.slice(half)) await tapPoint(page, `lane:${String(lane)}`);
  await waitState(page, (x) => x.game?.panel === 'win', 'win panel');
});

test('rapid taps through a long level: every animation is squeezed, nothing breaks', async ({
  page,
}) => {
  await page.goto(`${TEST}?reset=1&level=26${CANVAS}`, { waitUntil: 'load' });
  await playSolution(page);
  const won = await waitState(page, (s) => s.game?.panel === 'win', 'win panel');
  expect(won.game?.pending).toBe(0);
  // every muncher has eaten and left: no view is left behind in a slot or a den
  await waitState(page, (s) => s.game?.outViews === 0, 'all munchers gone');
  expect(won.game?.denViews).toBe(0);
});

async function at(page: Page, name: string): Promise<{ x: number; y: number }> {
  const p = await page.evaluate((n) => window.__munchDebug?.point(n) ?? null, name);
  if (!p) throw new Error(`${name}: no such point`);
  return p;
}

const pause = (page: Page, on: boolean): Promise<void> =>
  page.evaluate((v) => {
    window.__munchDebug?.pause?.(v);
  }, on);

test('a press held through a platform pause never taps (CLAUDE.md rule 4)', async ({ page }) => {
  await page.goto(`${TEST}?reset=1&level=20${CANVAS}`, { waitUntil: 'load' });
  await waitState(page, (s) => s.game?.inputOpen === true, 'playing');
  const front = await at(page, 'lane:0');
  await page.mouse.move(front.x, front.y);
  await page.mouse.down();
  await pause(page, true);
  await waitState(page, (s) => s.paused, 'paused');
  await pause(page, false);
  await page.waitForTimeout(600); // past the resume grace
  await page.mouse.up();
  await page.waitForTimeout(200);
  const s = await waitState(page, (x) => !x.paused, 'resumed');
  expect(s.game?.taps).toBe(0);
  // the next real tap works
  await tapPoint(page, 'lane:0');
  await waitState(page, (x) => x.game?.taps === 1, 'tap after resume');
});

test('a platform pause freezes the bite stream; resume plays it on', async ({ page }) => {
  await page.goto(`${TEST}?reset=1&level=26${CANVAS}`, { waitUntil: 'load' });
  const s = await waitState(page, (x) => x.game?.inputOpen === true, 'playing');
  for (const lane of (s.game?.solution ?? []).slice(0, 4)) {
    await tapPoint(page, `lane:${String(lane)}`);
  }
  await pause(page, true);
  const frozen = await waitState(page, (x) => x.paused && (x.game?.pending ?? 0) > 0, 'paused');
  await page.waitForTimeout(1000);
  const still = await waitState(page, (x) => x.paused, 'still paused');
  expect(still.game?.pending).toBe(frozen.game?.pending);
  // nothing on screen moved either (tweens frozen, not only the timeline)
  expect(still.game?.motion).toBeCloseTo(frozen.game?.motion ?? Number.NaN, 6);
  await pause(page, false);
  await waitState(page, (x) => x.game?.pending === 0, 'drained after resume');
});

test('runs on one den in a short screen: the munchers shown in the dens are fully drawn', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${TEST}?reset=1&level=70${CANVAS}`, { waitUntil: 'load' });
  const s = await waitState(page, (x) => x.game?.inputOpen === true, 'playing');
  const sol = s.game?.solution ?? [];
  for (const lane of sol.slice(0, Math.floor(sol.length / 2))) {
    await tapPoint(page, `lane:${String(lane)}`);
  }
  const settled = await waitState(
    page,
    (x) => x.game?.pending === 0 && x.game.faded === 0,
    'settled and fully drawn',
  );
  expect(settled.game?.denViews).toBeGreaterThan(0);
});

for (const [name, width, height] of [
  ['1:1', 800, 800],
  ['9:16', 405, 720],
] as const) {
  test(`rapid taps in ${name}: once settled, the screen shows exactly the rules`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto(`${TEST}?reset=1&level=70${CANVAS}`, { waitUntil: 'load' });
    const s = await waitState(page, (x) => x.game?.inputOpen === true, 'playing');
    const sol = s.game?.solution ?? [];
    let done = 0;
    for (const stop of [6, 17, 30]) {
      for (const lane of sol.slice(done, stop)) await tapPoint(page, `lane:${String(lane)}`);
      done = stop;
      await expectScreenTrue(page, `after ${String(stop)} taps`);
    }
  });
}

test('retry replays the level just lost, even if the save moved meanwhile', async ({ page }) => {
  await page.goto(`${TEST}?reset=1&level=20${CANVAS}`, { waitUntil: 'load' });
  await waitState(page, (s) => s.game?.inputOpen === true, 'playing');
  // a late save read lands while level 20 is played (adoptLateSave), moving progress to 40
  await page.evaluate(() => window.__munchDebug?.setSavedLevel?.(40));
  const taps = await page.evaluate(() => window.__munchDebug?.losingTaps?.() ?? null);
  for (const lane of taps ?? []) await tapPoint(page, `lane:${String(lane)}`);
  await waitState(page, (s) => s.game?.panel === 'lose' && s.game.panelReady, 'lose panel');
  await tapPoint(page, 'retry');
  const again = await waitState(
    page,
    (s) => s.game?.inputOpen === true && s.game.taps === 0,
    'retry',
  );
  expect(again.level).toBe(20);
});

test('a resize under a pause waits for the resume: nothing plays while paused', async ({
  page,
}) => {
  await page.goto(`${TEST}?reset=1&level=2${CANVAS}`, { waitUntil: 'load' });
  const s = await waitState(page, (x) => x.game?.inputOpen === true, 'playing');
  for (const lane of s.game?.solution ?? []) await tapPoint(page, `lane:${String(lane)}`);
  await pause(page, true);
  const frozen = await waitState(page, (x) => x.paused && (x.game?.pending ?? 0) > 0, 'paused');
  await page.setViewportSize({ width: 800, height: 800 });
  await page.waitForTimeout(500);
  const still = await waitState(page, (x) => x.paused, 'still paused');
  expect(still.game?.pending).toBe(frozen.game?.pending);
  expect(still.game?.panel).toBeNull();
  await pause(page, false);
  await waitState(page, (x) => x.game?.panel === 'win', 'win after resume');
});
