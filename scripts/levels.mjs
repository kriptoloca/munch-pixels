#!/usr/bin/env node
// Builds the level list (GENERATOR.md §6): `npm run levels` writes src/data/levels.json;
// `npm run levels:check` rebuilds in memory and fails when the committed file differs (CI), so
// the list is reproducible from the code. The generator is TypeScript under src/gen, loaded
// through Vite's SSR module loader (no extra dependency).
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const OUT = new URL('../src/data/levels.json', import.meta.url);
const check = process.argv.includes('--check');

const server = await createServer({
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});
try {
  const t0 = Date.now();
  const mod = await server.ssrLoadModule('/src/gen/build-levels.ts');
  const levels = mod.buildLevels();
  const text = `${JSON.stringify(levels)}\n`;
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (check) {
    let current = '';
    try {
      current = readFileSync(OUT, 'utf8');
    } catch {
      // missing file: reported below
    }
    if (current !== text) {
      console.error(
        'levels: src/data/levels.json differs from a fresh build; run `npm run levels`',
      );
      process.exitCode = 1;
    } else {
      console.log(`levels: OK (${String(levels.length)} levels reproduced in ${secs} s)`);
    }
  } else {
    writeFileSync(OUT, text);
    const d = levels.map((l) => l.metrics.difficulty);
    const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
    console.log(`levels: wrote ${String(levels.length)} levels in ${secs} s`);
    for (let i = 0; i < d.length; i += 10) {
      console.log(
        `  ${String(i + 1).padStart(3)}–${String(i + 10).padEnd(3)} ` +
          `difficulty avg ${avg(d.slice(i, i + 10))}`,
      );
    }
  }
} finally {
  await server.close();
}
