// Submission package (Epic 12): dist/ → one deterministic ZIP with index.html at the root.
// Pure functions over a directory, so tests can run them on a temporary tree.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync, zipSync } from 'fflate';

/** YouTube Playables (certification page, 2024 revision; re-check before submission). */
export const FILE_HARD_LIMIT = 30 * 1024 * 1024;
export const FILE_RECOMMENDED = 512 * 1024;
export const TOTAL_HARD_LIMIT = 250 * 1024 * 1024;
export const TOTAL_TARGET = 15 * 1024 * 1024;
/** No pre-compressed artefacts anywhere in the package (CLAUDE.md rule 2). */
export const FORBIDDEN_EXT = /\.(gz|br|zip)$/i;
/** Top-level folders of dist/ that never ship: the development build published at /test/. */
export const EXCLUDED_DIRS = ['test'];
/** Every entry gets this timestamp, so the same tree gives the same bytes on every machine. */
export const FIXED_MTIME = new Date('2026-01-01T00:00:00Z');

/**
 * Files under `root` as sorted, slash-separated relative paths; EXCLUDED_DIRS and dotfiles
 * are left out.
 * @param {string} root
 * @returns {string[]}
 */
export function listFiles(root) {
  const out = [];
  const walk = (dir, rel) => {
    for (const name of readdirSync(dir).sort()) {
      if (name.startsWith('.')) continue;
      if (rel === '' && EXCLUDED_DIRS.includes(name)) continue;
      const abs = join(dir, name);
      const next = rel === '' ? name : `${rel}/${name}`;
      if (statSync(abs).isDirectory()) walk(abs, next);
      else out.push(next);
    }
  };
  walk(root, '');
  return out.sort();
}

/**
 * Package rules over a file list with sizes.
 * @param {{ path: string, size: number }[]} files
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function checkTree(files) {
  const errors = [];
  const warnings = [];
  if (!files.some((f) => f.path === 'index.html')) errors.push('index.html must sit at the root');
  for (const f of files) {
    if (FORBIDDEN_EXT.test(f.path))
      errors.push(`${f.path}: pre-compressed artefacts are not allowed`);
    if (f.size > FILE_HARD_LIMIT)
      errors.push(`${f.path}: ${mb(f.size)} MB exceeds the 30 MB file limit`);
    else if (f.size > FILE_RECOMMENDED)
      warnings.push(`${f.path}: ${kb(f.size)} KB (YouTube recommends files under 512 KB)`);
  }
  const total = files.reduce((s, f) => s + f.size, 0);
  if (total > TOTAL_HARD_LIMIT) errors.push(`total ${mb(total)} MB exceeds the 250 MB limit`);
  else if (total > TOTAL_TARGET) warnings.push(`total ${mb(total)} MB above the 15 MB target`);
  return { errors, warnings };
}

/**
 * Builds the ZIP from `root`. Deterministic: sorted entries, fixed mtime, fixed level.
 * @param {string} root
 * @param {{ mtime?: Date, level?: 0|1|2|3|4|5|6|7|8|9 }} [opts]
 */
export function buildZip(root, opts = {}) {
  const mtime = opts.mtime ?? FIXED_MTIME;
  const level = opts.level ?? 9;
  const paths = listFiles(root);
  const files = paths.map((p) => {
    const data = readFileSync(join(root, p));
    return { path: p, size: data.length, data };
  });
  const { errors, warnings } = checkTree(files);
  /** @type {Record<string, [Uint8Array, { level: typeof level, mtime: Date }]>} */
  const entries = {};
  for (const f of files) entries[f.path] = [new Uint8Array(f.data), { level, mtime }];
  const zip = zipSync(entries, { level, mtime });
  const total = files.reduce((s, f) => s + f.size, 0);
  return {
    zip,
    files: files.map(({ path, size }) => ({ path, size })),
    total,
    errors,
    warnings,
    sha256: createHash('sha256').update(zip).digest('hex'),
  };
}

/**
 * Reads a ZIP back: entry names and whether index.html is at the root.
 * @param {Uint8Array} zip
 */
export function verifyZip(zip) {
  const entries = Object.keys(unzipSync(zip)).sort();
  return { entries, hasRootIndex: entries.includes('index.html') };
}

export function kb(n) {
  return String(Math.round(n / 1024));
}

export function mb(n) {
  return (n / 1024 / 1024).toFixed(2);
}
