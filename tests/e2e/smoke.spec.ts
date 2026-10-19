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
  await waitState(page, (s) => s.scene === 'Game' && s.level === 7, 'level 7');
});

test('the production build carries no debug hooks', async ({ page }) => {
  await page.goto('./', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => typeof window.__munchDebug)).toBe('undefined');
});
