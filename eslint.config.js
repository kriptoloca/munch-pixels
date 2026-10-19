// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const NO_NETWORK =
  'No network calls: YouTube Playables forbids external requests (CLAUDE.md rule 1).';

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
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: NO_NETWORK },
        { name: 'XMLHttpRequest', message: NO_NETWORK },
        { name: 'WebSocket', message: NO_NETWORK },
        { name: 'EventSource', message: NO_NETWORK },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'navigator', property: 'sendBeacon', message: NO_NETWORK },
        { object: 'window', property: 'fetch', message: NO_NETWORK },
        { object: 'globalThis', property: 'fetch', message: NO_NETWORK },
        { object: 'self', property: 'fetch', message: NO_NETWORK },
      ],
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
        },
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
