#!/bin/bash
# SessionStart hook (Claude Code cloud sessions only): installs the npm dependencies so
# `npm run check`, `npm test` and `npm run e2e` work in a fresh container. Synchronous on
# purpose: nothing runs before the dependencies are there. Playwright uses the preinstalled
# Chromium (PLAYWRIGHT_BROWSERS_PATH is set by the environment; never `playwright install`).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# npm install (not ci) keeps an existing node_modules and benefits from the cached container.
npm install --no-audit --no-fund --prefer-offline
