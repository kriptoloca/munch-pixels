# CLAUDE.md — Munch Pixels (Pebblit)

You are building a text-free pixel-eating colour sort game for Playgama (web portals) and YouTube
Playables, published via Playgama Bridge. Read `GDD.md` (design and the Feel spec), `GENERATOR.md`
(exact rules, generator, solver), `briefs/munch-pixels.md` (scope and milestones) and `TASKS.md`
(epics) before any work. Platform rules below are hard constraints; violating them fails
certification.

**Session start:** read `docs/PROGRESS.md` first (where we left off, next steps, Hasan's pending
steps), then `docs/questions.md` (decisions that override the spec). **Epic end:** update
`docs/PROGRESS.md` (board, measured, next steps) in the same commit.

## Stack
- Phaser 3.90.0, TypeScript 5.9.3 (strict), Vite 7.3.7. No React, no UI frameworks.
- npm, Node ≥ 20 (CI: 22). Every dependency pinned exactly (`.npmrc` save-exact); no new
  dependency without a reason line in `docs/questions.md`.
- Tests: Vitest for everything pure (rules, generator, solver, metrics, layout, ad gate, save
  model, feel constants); Playwright e2e against the dev build (`npm run build:test`).
- Commands: `npm run dev` (LAN dev server), `npm run build` (dist/ + post-build audit),
  `npm test`, `npm run check` (tsc + eslint + prettier --check), `npm run levels`
  (rebuild `src/data/levels.json`), `npm run levels:check`, `npm run e2e`, `npm run size`,
  `npm run zip` (submission ZIP + SHA-256).

## Platform hard constraints (YouTube Playables, same as Peek & Find)
1. **No external network calls.** No fetch/XHR/WebSocket/beacon, no analytics SDKs, no external
   fonts, no CDN scripts. ESLint forbids them in `src/`; `scripts/audit-dist.mjs` fails the build
   on any `http(s)://` URL in `dist/` other than the bundled Bridge script, or any
   `.gz`/`.br`/`.zip` file.
2. **Size:** initial load (everything before GameReady) ≤ 30 MB hard, ≤ 8 MB target. No file
   > 30 MB. No build-time compression. `build.assetsInlineLimit = 0`; relative paths only.
3. **GameReady** only when the Title is interactive with its assets loaded.
4. **Pause/mute:** platform pause stops all tweens, timers, audio and input, with a dim overlay;
   resume restores. Platform mute silences everything regardless of in-game toggles. The tap
   that wakes the game after a pause is never a game tap (`ResumeGrace`).
5. **Aspect ratios:** 9:16 (primary), 1:1, 16:9 all correct. Phaser `Scale.FIT` with a design
   size that follows the window aspect: short side 1080 design px, long side `1080 × aspect`
   clamped to [1080, 2400]; on resize `scale.setGameSize(w, h)` then `layout()`. `computeLayout`
   is pure and unit-tested.
6. **Ads:** an interstitial only between levels and only when BOTH hold: ≥ 3 levels completed
   since the last interstitial (or session start) AND ≥ 120 s since the last one (or session
   start); `setMinimumDelayBetweenInterstitial(120)` as a second guard. Never a countdown.
   Rewarded only for the boosters (`slot`, `undo`). Check support before calling; the game is
   fully playable with ads unsupported or failing.
7. **Saves:** Bridge storage; dev fallback localStorage behind the same interface; never throw;
   the save carries `version`.
8. **Content:** no text in gameplay (digits allowed), no third-party IP, cartoon only, 13+, no
   nursery palette, no baby-faced characters; store text never says "kids", "children",
   "toddler", "baby".
9. **No timers before interstitials, no banners, no IAP, no off-platform links** (the share
   button is hidden on YouTube).

## Rendering
- Every colour a player must tell apart (pixels, munchers, crumbs) is drawn in that colour, never
  produced with runtime tint (`setTint` only darkens and the Canvas renderer ignores it).
  Muncher and face textures are drawn procedurally at boot, one texture per colour.
  `setTintFill` is allowed for feedback flashes only.
- The snack is drawn into a canvas texture and updated per bite, so a 20×20 board costs one
  texture, not 400 game objects.

## Project structure
```
src/
  main.ts               # Phaser config, scale, scenes
  config.ts             # design sizes and layout constants
  core/                 # rules: board.ts, game.ts (pure, no Phaser)
  gen/                  # rng.ts, generate.ts, solve.ts, metrics.ts, face.ts, build-levels.ts (pure)
  data/                 # palette.ts, snacks.ts, levels.json, strings.ts
  platform/             # bridge.ts, storage.ts, ads.ts, analytics.ts, haptics.ts, host.ts, ios-unmute.ts
  game/                 # layout.ts, feel.ts, audio.ts, textures.ts, resume-grace.ts, state.ts, scenes/
  dev/                  # debug hooks (__munchDebug), dev-only
scripts/                # levels.mjs, audit-dist.mjs, build-test.mjs, write-version.mjs, size.mjs, zip.mjs, audio.mjs, lib/
tests/                  # vitest (*.test.ts) and tests/e2e (Playwright)
docs/                   # PROGRESS.md, questions.md, skills.md
briefs/                 # build brief
```
`src/core` and `src/gen` stay pure (no Phaser imports; ESLint enforces it) so they are
deterministic and unit-testable.

## Coding rules
- TypeScript strict, no `any`. ESLint + Prettier, 100 columns.
- Determinism: all randomness goes through `Rng` from a seed; same seed → identical level.
- No magic numbers in gameplay code: constants live in `src/config.ts`, `src/game/feel.ts`,
  `src/gen/params.ts`, with a comment each.
- Taps: a front muncher counts when the pointer goes down and up inside its hit circle
  (radius `max(60, size / 2)` design px). Boosters and panels act on pointer-up.
- Performance: one canvas texture for the snack, pooled bite sprites and crumbs, no per-frame
  allocations in update loops.
- Every behaviour change gets a test; a bug fix starts with a red test.

## Skills (`docs/skills.md` maps them to steps)
Every game design, feel or polish change goes through `pebblit-game-craft` (Face, Feel, Flow,
Fair, Share; the Feel spec in GDD §3a is the contract). Every epic ends with `code-review` and an
independent adversarial audit subagent against the GDD, GENERATOR.md and these rules; KRİTİK and
YÜKSEK findings are closed before the push. Store text goes through `design:ux-copy`; launch
through `game-trend-skills:launching-on-zero-budget`; numbers after launch through
`game-trend-skills:tracking-game-metrics`.

## Commits and definition of done
- Commit per epic: `feat(epic-N): <summary>`; small fix commits allowed. Push to `main`.
- Every epic ends with: `npm run check` clean, `npm test` green, `npm run build` succeeds,
  `npm run levels:check` clean, `npm run e2e` green, PROGRESS updated.
- Project done (v0.1): Playgama QA tool passes; 9:16, 1:1, 16:9 screenshot-verified; 20
  consecutive levels on a phone without frame drops; initial load < 8 MB.
