// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const NO_NETWORK =
  'No network calls: YouTube Playables forbids external requests (CLAUDE.md rule 1).';

// Shared by every src block: a later block that restricts more globals or properties must repeat
// these, because ESLint replaces a rule's options per block instead of merging them.
const NETWORK_GLOBALS = [
  { name: 'fetch', message: NO_NETWORK },
  { name: 'XMLHttpRequest', message: NO_NETWORK },
  { name: 'WebSocket', message: NO_NETWORK },
  { name: 'EventSource', message: NO_NETWORK },
];
const NETWORK_PROPERTIES = [
  { object: 'navigator', property: 'sendBeacon', message: NO_NETWORK },
  { object: 'window', property: 'fetch', message: NO_NETWORK },
  { object: 'globalThis', property: 'fetch', message: NO_NETWORK },
  { object: 'self', property: 'fetch', message: NO_NETWORK },
];

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser },
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS],
      'no-restricted-properties': ['error', ...NETWORK_PROPERTIES],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='WebSocket']", message: NO_NETWORK },
        { selector: "NewExpression[callee.name='XMLHttpRequest']", message: NO_NETWORK },
        { selector: "NewExpression[callee.name='EventSource']", message: NO_NETWORK },
      ],
    },
  },
  {
    // Rules, generator, data and ad gating stay Phaser-free so they are pure and unit-testable.
    files: ['src/core/**/*.ts', 'src/gen/**/*.ts', 'src/data/**/*.ts', 'src/platform/ads.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'phaser', message: 'core/, gen/, data/ and ads.ts must stay Phaser-free.' },
          ],
          patterns: [
            { group: ['phaser/*', '@playgama/*'], message: 'Keep the pure modules engine-free.' },
            {
              group: ['**/game/**', '**/platform/**', '**/dev/**'],
              message: 'Pure modules import only core/, gen/ and data/.',
            },
            {
              group: ['node:*', 'crypto', 'perf_hooks', 'timers', 'timers/*', 'os', 'process'],
              message: 'No clocks, entropy or host APIs in the rules or the generator.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        ...NETWORK_PROPERTIES,
        { object: 'Math', property: 'random', message: 'Use the seeded Rng (determinism).' },
        { object: 'Date', property: 'now', message: 'No clocks in the rules or the generator.' },
      ],
      'no-restricted-globals': [
        'error',
        ...NETWORK_GLOBALS,
        { name: 'window', message: 'The pure modules run in Node too.' },
        { name: 'document', message: 'The pure modules run in Node too.' },
        { name: 'performance', message: 'No clocks in the rules or the generator.' },
        { name: 'Date', message: 'No clocks in the rules or the generator.' },
        { name: 'crypto', message: 'Use the seeded Rng (determinism).' },
        { name: 'setTimeout', message: 'The pure modules have no timers.' },
        { name: 'setInterval', message: 'The pure modules have no timers.' },
        { name: 'queueMicrotask', message: 'The pure modules have no timers.' },
        { name: 'requestAnimationFrame', message: 'The pure modules have no timers.' },
        { name: 'globalThis', message: 'Reach nothing through the global object here.' },
        { name: 'self', message: 'Reach nothing through the global object here.' },
        { name: 'process', message: 'The pure modules run anywhere.' },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['scripts/**/*.mjs', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
