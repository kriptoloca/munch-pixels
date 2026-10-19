#!/usr/bin/env node
// Builds the development-mode bundle into dist/test/: the same game as production plus the dev
// shortcuts (?level=, ?fakeads=1, ?reset=1, ?renderer=canvas) and the
// __munchDebug hooks the e2e tests drive. Published at /test/ by GitHub Pages (Epic 6).
//
// `vite build --mode development` alone is not enough: import.meta.env.DEV follows NODE_ENV,
// which Vite sets to "production" for every build unless the environment says otherwise. This
// script sets it explicitly, so the result is the same on every OS and in CI.
import { build } from 'vite';

process.env.NODE_ENV = 'development';

await build({
  mode: 'development',
  build: { outDir: 'dist/test', emptyOutDir: true },
  logLevel: 'info',
});
