#!/usr/bin/env node
// Reports dist/ size against the Playables budget (CLAUDE.md rule 2). Munch Pixels loads
// everything it ships before GameReady (bundle with the level list, Bridge runtime, its config,
// audio), so the initial load is the whole production tree without the /test/ dev build.
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const TARGET = 8 * 1024 * 1024;
const HARD = 30 * 1024 * 1024;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push({ path: relative(DIST, p), size: st.size });
  }
  return out;
}

const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
const kb = (n) => Math.round(n / 1024) + ' KB';

const files = walk(DIST).filter((f) => !f.path.startsWith('test/'));
const total = files.reduce((s, f) => s + f.size, 0);
const biggest = Math.max(0, ...files.map((f) => f.size));
console.log(`dist (production, ${String(files.length)} files): ${mb(total)}`);
console.log(`initial load: ${mb(total)} (target ${mb(TARGET)}, hard ${mb(HARD)})`);
for (const f of [...files].sort((a, b) => b.size - a.size).slice(0, 10)) {
  console.log(`  ${kb(f.size).padStart(8)}  ${f.path}`);
}
if (total > HARD || biggest > HARD) {
  console.error('size: FAIL (over the 30 MB hard limit)');
  process.exit(1);
}
if (total > TARGET) console.warn('size: over the 8 MB target');
