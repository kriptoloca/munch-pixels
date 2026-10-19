import { expect } from '@playwright/test';
import { CANVAS, TEST, tapPoint, test, waitState } from './helpers';

test('Title: a press held through a platform pause does not start the game', async ({ page }) => {
  await page.goto(`${TEST}?reset=1${CANVAS}`, { waitUntil: 'load' });
  await waitState(page, (s) => s.scene === 'Title', 'title');
  const play = await page.evaluate(() => window.__munchDebug?.point('play') ?? null);
  if (!play) throw new Error('no play button');
  await page.mouse.move(play.x, play.y);
  await page.mouse.down();
  await page.evaluate(() => window.__munchDebug?.pause?.(true));
  await waitState(page, (s) => s.paused, 'paused');
  await page.evaluate(() => window.__munchDebug?.pause?.(false));
  await page.waitForTimeout(600);
  await page.mouse.up();
  await page.waitForTimeout(500);
  const s = await waitState(page, (x) => !x.paused, 'resumed');
  expect(s.scene).toBe('Title');
});

test('Title: after turning the phone the play button is on screen and starts the game', async ({
  page,
}) => {
  await page.goto(`${TEST}?reset=1${CANVAS}`, { waitUntil: 'load' });
  await waitState(page, (s) => s.scene === 'Title', 'title');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(500);
  const play = await page.evaluate(() => window.__munchDebug?.point('play') ?? null);
  expect(play).not.toBeNull();
  expect(play?.y ?? 9999).toBeLessThan(720);
  expect(play?.x ?? 9999).toBeLessThan(1280);
  await tapPoint(page, 'play');
  await waitState(page, (s) => s.scene === 'Game', 'game after rotation');
});
