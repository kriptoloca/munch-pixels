import { expect } from '@playwright/test';
import { CANVAS, TEST, tapPoint, test, waitState } from './helpers';

/** Epic 0: the path from boot to the first scene works, same-origin, without console errors. */
test('boot → Title (GameReady once, after loading) → play → Game', async ({ page }) => {
  await page.goto(`${TEST}?reset=1${CANVAS}`, { waitUntil: 'load' });
  const title = await waitState(page, (s) => s.scene === 'Title', 'title');
  expect(title.level).toBe(1);
  const msgs = title.messages;
  expect(msgs.filter((m) => m === 'game_ready')).toHaveLength(1);
  expect(msgs.indexOf('in_game_loading_started')).toBeLessThan(msgs.indexOf('game_ready'));
  await tapPoint(page, 'play');
  await waitState(page, (s) => s.scene === 'Game' && s.level === 1, 'game');
});

test('?level=N jumps into that level (dev shortcut)', async ({ page }) => {
  await page.goto(`${TEST}?reset=1&level=7${CANVAS}`, { waitUntil: 'load' });
  const game = await waitState(page, (s) => s.scene === 'Game' && s.level === 7, 'level 7');
  // the Game is the first interactive screen here, so it closes the loading and sends GameReady
  expect(game.messages.filter((m) => m === 'in_game_loading_stopped')).toHaveLength(1);
  expect(game.messages.filter((m) => m === 'game_ready')).toHaveLength(1);
});

test('the production build carries no debug hooks', async ({ page, request }) => {
  await page.goto('./', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => typeof window.__munchDebug)).toBe('undefined');
  // nor their code: the shipped scripts never mention them
  const html = await (await request.get('./')).text();
  const scripts = [...html.matchAll(/src="\.\/(assets\/[^"]+\.js)"/g)].map((m) => m[1] ?? '');
  expect(scripts.length).toBeGreaterThan(0);
  for (const src of scripts) {
    const js = await (await request.get(`./${src}`)).text();
    expect(js, src).not.toContain('__munchDebug');
    expect(js, src).not.toContain('losingTaps');
  }
});
