import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Coding rules that no behaviour shows (CLAUDE.md "Coding rules", "Performance"), read from the
 * source: comments and string literals are blanked first, so only code is checked.
 */
function code(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
}

describe('no per-pixel allocation on the bite path (CLAUDE.md "Performance")', () => {
  it('a landing bite hands its sound a reused scratch object, never a new one', () => {
    const src = code('src/game/scenes/GameScene.ts');
    const start = src.indexOf('private readonly onLand = ');
    expect(start).toBeGreaterThan(0);
    const body = src.slice(start, src.indexOf('\n  };', start));
    // an object literal passed to a call: `f({ … })` or `f(a, { … })`
    expect(body).not.toMatch(/[(,]\s*\{/);
  });

  it('a sound without options uses one shared empty object, not a fresh default', () => {
    for (const path of ['src/game/scenes/GameScene.ts', 'src/game/audio.ts']) {
      expect(code(path).match(/SfxOptions>?\s*=\s*\{\s*\}/g) ?? [], path).toEqual([]);
    }
  });
});

describe('tuning numbers live in feel.ts and config.ts (CLAUDE.md "No magic numbers")', () => {
  it.each(['src/game/fx.ts', 'src/game/audio.ts'])(
    '%s uses no number beyond 0, 1, 2 and ½',
    (path) => {
      const numbers = code(path).match(/(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g) ?? [];
      expect(numbers.filter((n) => !['0', '1', '2', '0.5'].includes(n))).toEqual([]);
    },
  );
});
