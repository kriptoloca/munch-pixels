# TASKS.md — epics in build order

Each epic ends with the checks in CLAUDE.md (check, test, build, levels:check, e2e), `code-review`
and an independent adversarial audit (KRİTİK/YÜKSEK closed), PROGRESS updated, one commit
`feat(epic-N): …` pushed to `main`. "AC" = acceptance criteria; each has a test or a check.

## Epic 0 — Scaffold and pipeline
Port the toolchain and the platform layer from Peek & Find (same versions).
- Configs: package.json (exact versions), tsconfig, eslint (no-network rules, pure `core/` and
  `gen/`), prettier, vite (Bridge plugin in local mode, relative base, no inlining), vitest,
  playwright, .npmrc, .nvmrc, .gitignore, index.html.
- Scripts: `audit-dist.mjs`, `build-test.mjs`, `write-version.mjs`, `size.mjs`, `zip.mjs` +
  `lib/zip.mjs`, `dev-url.mjs`.
- Platform: `bridge.ts` (placements `slot`, `undo`), `storage.ts` (Munch save model), `ads.ts`
  (AdGate), `haptics.ts`, `host.ts`, `ios-unmute.ts`, `analytics.ts` (local `track`),
  `game/resume-grace.ts`.
- Scenes: Boot (Bridge, save, GameReady after Title), Title stub, Game stub; dev debug hooks.
- CI: GitHub Actions (check, test, build, size, zip artifact, e2e).
- AC: `npm run check`, `npm test`, `npm run build` green; e2e smoke: boot → Title → tap → Game
  stub, no external requests, no console errors, GameReady sent once after the Title is
  interactive.

## Epic 1 — Core rules (`src/core`)
- `board.ts`: cells, open ground (flood fill from the border), exposure, reachable order.
- `game.ts`: state, `tap`, `resolve` with bite events, won/lost, `extraSlot`, `undo`, `replay`.
- AC: the four worked examples of GENERATOR.md §2 as tests; holes; chains; exact-totals
  completion; lose only with full slots; undo restores exactly; replay rejects illegal taps.

## Epic 2 — Content pipeline (M0)
- `data/palette.ts` (7+ colours), `data/snacks.ts` (≥ 24 hand-drawn snacks, small ones for the
  first levels), `gen/rng.ts`, `gen/params.ts` (bands), `gen/generate.ts`, `gen/solve.ts`,
  `gen/metrics.ts`, `gen/face.ts`, `gen/build-levels.ts`, `scripts/levels.mjs`.
- AC: `npm run levels` → 100 levels, all valid, all replay to a win; moving-average difficulty
  rises (band averages strictly rise, and the 10-level moving average never falls more than
  one breather (`BREATHER_DROP`, 0.15) below its running best: the sawtooth dips, the curve does not); determinism;
  `levels:check` reproduces; generator invariants over 200 seeds per band.

## Epic 3 — Graybox loop (M1)
- `game/layout.ts` (portrait/landscape/square; snack square, slot row, dens, HUD), pure + tests.
- `game/scenes/GameScene.ts`: snack canvas texture, slots, dens with queues, taps, resolve,
  bite animation (graybox timing), win and lose panels, retry, next level, save progress.
- Debug hooks: state, tap points of lane fronts, `solution` of the current level.
- AC: e2e plays level 1 by the stored solution through real taps → win → level 2 saved; a
  losing order on a trap level → lose panel → retry restarts the level; 9:16, 1:1, 16:9 lay out
  without overlap (layout tests).

## Epic 4 — Feel and art (M2)
- `game/feel.ts` constants (GDD §3a), procedural muncher and face textures, bite stream, crumbs,
  belly swell, full-meal hit stop and kick, combo step, chain wake, waiting face, nope wobble,
  win reveal, stuck faces; synthesized sounds (`scripts/audio.mjs`); haptics.
- AC: unit tests (success outweighs failure: haptics, sounds as played); e2e feel log (bites
  ascend in pitch, a full meal logs a kick, a tap on a muncher behind the front logs a nope and no camera shake); muted 10-second
  capture of level 20 attached to PROGRESS.

## Epic 5 — Platform, boosters and ads
- Bridge lifecycle (GameReady, gameplay start/stop, level messages), pause/mute freeze and dim,
  ResumeGrace, rewarded `slot` and `undo` buttons (hidden when unsupported), lose-panel
  continue, interstitial between levels behind AdGate, analytics `track`, pause menu (resume,
  sound, music, home).
- AC: e2e with `?fakeads=1`: boosters work and are real button taps; no interstitial before
  3 levels and 120 s; platform pause freezes the bite stream and blocks taps; mute silences.

## Epic 6 — Title, brand, store, release (M3)
- Title screen, brand marks, thumbnails and screenshots scripts, store listing (`design:ux-copy`),
  share button for web portals (Web Share API / download; hidden on YouTube), certification
  checklist, Pages deploy of `/test/`, `npm run zip`.
- AC: ZIP within limits with SHA in `docs/store/submission.md`; screenshots in three aspects;
  Hasan: Playgama upload and QA tool, phone check.
