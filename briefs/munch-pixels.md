# Build brief: Munch Pixels (`writing-game-agent-briefs`, 2026-10-19)

Read with `GDD.md` (design, Feel spec), `GENERATOR.md` (exact rules, generator, solver) and
`CLAUDE.md` (hard rules). Idea card: `peek-and-find/reports/2026-10-19-ideas-next-game.md`, idea A.

## 1. Goal & hypothesis

We believe **a pixel-eating colour sort with a face** (munchers that swallow a snack pixel by
pixel, a hidden face under every snack, every level fair without boosters) will reach the
Playgama sandbox targets of **100 plays and a 5:00 average play time** (Playgama dashboard,
2026-10-18) and beat Peek & Find's own average session on the same portal. This build exists
to test that, as cheaply as possible.

## 2. Non-goals (do not build)

Accounts, backend, any network call, leaderboards, a daily level, the album screen, a level
editor, IAP, banners, localisation beyond the ≤ 10 UI strings, more than two boosters,
obstacles (ice, locks, keys), hidden queues, a timer, hearts, stars, analytics SDKs, cloud
saves beyond the Bridge storage API, runtime level generation.

## 3. Core loop spec

Exact rules in GENERATOR.md §2; summary with the numbers:
- Snack: a pixel picture, 6×6 to 20×20 cells, ≤ 7 colours, transparent background.
- 5 waiting slots (+1 with the booster, once per level). 2–5 lanes of munchers; only the front
  muncher of a lane can be tapped; all queues visible.
- Tap → the front muncher takes the leftmost free slot → resolve: slots left to right, each
  muncher eats up to its remaining appetite from the reachable pixels of its colour in
  breadth-first order from the open ground; full munchers leave; repeat until stable.
- Win: no pixel left. Lose: every slot holds a muncher that cannot eat and a lane is not empty.
- Exact appetite totals per colour; every level has a stored solution that replays to a win.

## 4. Controls & feel

Input: one tap on a front muncher (pointer-up inside its hit circle, radius ≥ 60 design px);
taps on boosters, pause, panels. No drag, no long press. The juice list is GDD §3a, the part the
muted 3-second clip depends on: **the bite stream** (pixels lift off the snack and fly into the
mouth every 70 ms with a rising tick and a swelling belly), **the full meal** (hit stop 45 ms,
kick, burp, waddle off) and **the chain** (a waiting muncher wakes and eats). Failure is soft
(no camera shake). All values are named constants in `src/game/feel.ts`.

## 5. Content pipeline (build first, as a separate tool)

`src/gen` + `scripts/levels.mjs` (GENERATOR.md §3–6): snacks drawn as data → generator (peel the
picture into a planned solution, deal it into lanes) → proof by replay → metrics (random-player
win rate, greedy win, peak slots, first-move traps) → `src/data/levels.json`.
**Acceptance:** `npm run levels` writes 100 levels, every one validates and replays to a win,
the 10-level moving average of `difficulty` rises from band 1 to band 5, `npm run levels:check`
reproduces the file byte for byte.

## 6. Systems, in build order

1. Scaffold and pipeline (lint, types, tests, build, size audit, ZIP, CI) — the release path
   exists from day one.
2. Platform layer ported from Peek & Find: Bridge wrapper with stubs, storage, ad gate,
   haptics, iOS unmute, resume grace — the game runs on the stub and on the real SDK.
3. Core rules (`src/core`) — the game logic, pure and tested.
4. Content pipeline (§5).
5. Layout (`computeLayout`, pure) and the graybox scene: snack, slots, dens, taps, bites, win and
   lose panels, next level, save.
6. Feel and procedural art: muncher textures, the bite stream, hit stop, kicks, crumbs, faces,
   synthesized sounds.
7. Boosters and ads: rewarded `slot` and `undo`, interstitial between levels behind the gate.
8. Title, pause menu, settings, brand, store assets, release.

## 7. Monetization hooks

One interface (`Platform` in `src/platform/bridge.ts`, as in Peek & Find):
`showRewarded(placement: 'slot' | 'undo'): Promise<boolean>` and `showInterstitial(): Promise<void>`,
stubbed when the SDK is absent and with a dev fake (`?fakeads=1`). Call sites: the two booster
buttons, the lose panel (`slot`), and between levels (interstitial, gated by `AdGate`: ≥ 3 levels
and ≥ 120 s). The real SDK (Playgama Bridge 2.3.1) is already the target; no other ad SDK.

## 8. Analytics events

No network (platform rule), so one local interface `track(event, props)` (`src/platform/analytics.ts`)
that counts in memory, shows in the dev state, and forwards the lifecycle messages the Bridge
knows: `session_start`, `level_start` (→ `level_started`), `level_complete` (→ `level_completed`,
with level id and seconds), `level_fail` (→ `level_failed`, with level id and seconds),
`booster_used` (slot/undo), `ad_rewarded_shown`, `ad_interstitial_shown`, `session_end`.

## 9. Tech constraints

Phaser 3.90.0, TypeScript 5.9.3 strict, Vite 7.3.7, Vitest 4.1.12, Playwright 1.56.1,
@playgama/bridge 2.3.1, Node 22; exact versions, no `^`/`~`; no new dependency without a line
in docs/questions.md. Web (Playgama, then YouTube Playables); portrait primary, 1:1 and 16:9
correct. 60 fps on a mid-range phone; no per-frame allocations in update loops; initial load
≤ 8 MB target (expect < 3 MB), no file > 30 MB, no compression plugins, no external URLs in
`dist/` except the bundled Bridge script.

## 10. Milestones with acceptance criteria

| M | What | A person can check |
| --- | --- | --- |
| M0 | Content tool | `npm run levels` → 100 validated levels, difficulty rising; tests green |
| M1 | Graybox loop | level 1 playable start → win; a forced bad order → lose → retry; next level saves |
| M2 | Juice + levels + stubs | a muted 10-second capture of level 20 looks like an ad: bite streams, a chain, a full meal, the face |
| M3 | Build | `npm run zip` → ZIP within limits; 9:16, 1:1, 16:9 screenshots; Playgama QA tool passes (Hasan); 60 fps on a phone (Hasan) |

## 11. Verification

- Vitest: rules (worked examples), generator invariants and determinism, solver, metrics, level
  list, layout, ad gate, storage, feel constants (success outweighs failure).
- Playwright (dev build with `__munchDebug` hooks): boot → title → level 1 played to a win by the
  stored solution through real taps; a losing order → lose panel → retry; boosters with fake ads;
  pause/resume freezes the bite stream; 9:16, 1:1, 16:9 layouts; no external requests; GameReady
  order.
- `npm run build` (+ size audit), `npm run zip`, CI on every push.

## 12. Open questions (defaults used until answered)

| Question | Default |
| --- | --- |
| Final name | "Munch Pixels" as a working title; check stores and portals before the store listing |
| Colour-blind support | distinct hue + lightness per colour; a shape mark per colour on the munchers if testers report trouble |
| After level 100 | replay level 100's band with new seeds in v0.2; v0.1 keeps showing the last level |
| Art | procedural muncher and face drawing at boot; snacks hand-drawn as data; an art pass after the first sandbox numbers |
| YouTube share button | hidden (off-platform action); the face card stays as the payoff |
