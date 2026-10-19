#!/usr/bin/env node
// Writes dist/version.json ({ sha }) after a production build, so the live e2e run can prove it
// tests the commit it was started for (GitHub Pages serves stale files for up to ten minutes).
// Only the SHA: a timestamp would break the byte-identical submission ZIP.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let sha = process.env.GITHUB_SHA ?? '';
if (!sha) {
  try {
    sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    sha = 'unknown';
  }
}
const out = fileURLToPath(new URL('../dist/version.json', import.meta.url));
writeFileSync(out, `${JSON.stringify({ sha })}\n`);
console.log(`version.json: ${sha}`);
