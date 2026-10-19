#!/usr/bin/env node
// Submission package (Epic 6): `npm run zip` builds the production bundle and packs dist/
// (without the /test/ development build) into release/munch-pixels-<version>.zip with
// index.html at the root. Same tree → same bytes (sorted entries, fixed timestamps), so the
// printed SHA-256 identifies a build. Fails on anything the platform would reject.
//
//   node scripts/zip.mjs                 pack dist/ → release/
//   node scripts/zip.mjs --out x.zip     another output path
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildZip, kb, mb, verifyZip } from './lib/zip.mjs';

const ROOT = new URL('../', import.meta.url);
const DIST = fileURLToPath(new URL('dist/', ROOT));
const pkg = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8'));
const outIdx = process.argv.indexOf('--out');
const out =
  outIdx !== -1
    ? process.argv[outIdx + 1]
    : fileURLToPath(new URL(`release/${pkg.name}-${pkg.version}.zip`, ROOT));

if (!existsSync(`${DIST}index.html`)) {
  console.error('dist/index.html missing: run `npm run build` first (or `npm run zip`)');
  process.exit(1);
}

const r = buildZip(DIST);
const back = verifyZip(r.zip);
if (!back.hasRootIndex || back.entries.length !== r.files.length) {
  r.errors.push('the written archive does not list the same files as dist/');
}

console.log(
  `submission package from dist/ (${String(r.files.length)} files, ${mb(r.total)} MB raw)`,
);
for (const f of [...r.files].sort((a, b) => b.size - a.size).slice(0, 8)) {
  console.log(`  ${kb(f.size).padStart(6)} KB  ${f.path}`);
}
for (const w of r.warnings) console.log(`  warning: ${w}`);
for (const e of r.errors) console.error(`  error: ${e}`);
if (r.errors.length > 0) process.exit(1);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, r.zip);
console.log(`written ${out} (${mb(r.zip.length)} MB zipped)\nsha256 ${r.sha256}`);
