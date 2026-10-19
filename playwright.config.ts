import { defineConfig } from '@playwright/test';

/**
 * End-to-end checks from the player's side (tests/e2e). Targets:
 *  - default: the local production build served by `vite preview` (run `npm run build:test`
 *    first; `npm run e2e` does both). dist/test/ holds the development-mode build with the dev
 *    shortcuts, exactly like the published /test/ page;
 *  - E2E_BASE_URL=https://kriptoloca.github.io/munch-pixels/ : the live GitHub Pages site.
 * Chromium runs with SwiftShader so WebGL works headless, and autoplay is allowed so the audio
 * graph can be measured.
 */
const live = process.env.E2E_BASE_URL;
const baseURL = live ?? 'http://127.0.0.1:4173/';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: live ? 1 : 0,
  // A live retry may pass against a stale CDN copy; a flaky live run is reported as a failure.
  failOnFlakyTests: Boolean(live),
  workers: process.env.CI ? 1 : 2,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL,
    headless: true,
    viewport: { width: 390, height: 844 },
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: live
    ? undefined
    : {
        command: 'npx vite preview --port 4173 --strictPort',
        url: 'http://127.0.0.1:4173/',
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
