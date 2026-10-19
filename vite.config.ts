import playgamaBridge from '@playgama/bridge/vite';
import { defineConfig } from 'vite';

// Platform rules (CLAUDE.md): relative base so the ZIP works from any folder,
// no inlined assets, no compression plugins, no external origins.
// The Bridge runtime is shipped with the game (mode "local"): the plugin injects
// <script src="./playgama-bridge.js"> and emits the file into dist/ — no CDN.
export default defineConfig({
  base: './',
  plugins: [playgamaBridge({ mode: 'local' })],
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1600,
  },
});
