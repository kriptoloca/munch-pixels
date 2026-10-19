# PROGRESS.md — where we are

Single source of truth for "where did we leave off". Read first at the start of every session;
update at the end of every epic.

## Status
Epic: 4 (feel and art) next · M1 graybox done 2026-10-19 · Last update: 2026-10-19 · Branch: main
Repo: https://github.com/kriptoloca/munch-pixels

## Session plan (2026-10-19)
Hasan: "plan step by step, completely, then start coding; scan all skills and use the needed ones."
- [x] Plan: GDD.md (+ Feel spec §3a), GENERATOR.md, briefs/munch-pixels.md, CLAUDE.md, TASKS.md,
      docs/questions.md, docs/skills.md, this file.
- [x] Epic 0: scaffold, pipeline, platform layer, CI, smoke e2e, SessionStart hook.
- [x] Epic 1: core rules with the worked examples.
- [x] Epic 2: content pipeline, 100 levels (M0).
- [x] Epic 3: graybox loop (M1).
- [ ] Epics 4–6: feel and art, platform and boosters, release.

## Epic board
| Epic | Scope | Status | Evidence |
| --- | --- | --- | --- |
| 0 | Scaffold, pipeline, platform layer | done | toolchain and platform layer ported from Peek & Find (same versions); save model, analytics (local), haptics kinds; 23 unit + 3 e2e; CI; `.claude/hooks/session-start.sh` (npm install in cloud sessions); review and audit folded into Epic 1's |
| 1 | Core rules | done | `src/core`: open ground, exposure, reachable order, resolve with events, won/lost, +1 slot, undo, replay; the four worked examples; property tests (2000 random levels: lost only with full slots, a free slot while playing, all out ⇒ won; 1000 mixes of taps, undos and +1 slot equal a replay); `Game.clone`/`append` for the generator and solver |
| 2 | Content pipeline (M0) | done | 30 snacks, palette (outline ink `d`), seeded generator with runs and planned waits, exact solver, metrics, procedural faces (dusty palette, ΔE ≥ 18 from every snack colour); `npm run levels` → 100 levels in ≈ 2 min, `levels:check` reproduces them byte for byte (CI step); measured numbers below |
| 3 | Graybox loop (M1) | done | `computeLayout` (portrait bands, square, landscape split; tested over every design size), Game scene: snack canvas texture with bevelled tiles and the face beneath, slots, dens with the queue as small munchers and "+N", taps with nope, the playback `Timeline` (fast-forward on a new tap, muncher ids), win/lose panels, retry/next, progress saved on the win; Pages workflow for `/test/`; 19 e2e (level 1 by its solution → level 2 saved, lose → retry of the same level, nope, 1:1 and 16:9, resize mid-level and under a pause, rapid taps with the settled screen compared to the rules in 1:1 and 9:16, pause holds presses and freezes everything, Title press and rotation, no debug code in production) |
| 4 | Feel and art (M2) | planned | |
| 5 | Platform, boosters, ads | planned | |
| 6 | Title, brand, store, release (M3) | planned | |

## Measured (Epic 2, `src/data/levels.json`, 2026-10-19)
- Difficulty = 1 − random-player win rate (1000 playouts per level). Band averages: levels 1–3
  0.00, 4–10 0.11, 11–30 0.28, 31–60 0.48, 61–100 0.57. Decades: 0.08, 0.23, 0.32, 0.45, 0.49,
  0.49, 0.57, 0.63, 0.58, 0.51; the 10-level moving average dips at most 0.14 below its best
  (bound: one breather, 0.15).
- Planning peaks (every 10th from 20): 8 of 9 are lost by the greedy player (all but level 100);
  15 of 100 levels overall. Level 70 is the hardest (random win ≈ 1 %).
- 18 of 100 levels sit outside their target band (most by < 0.1; the planning peaks rank a
  greedy loss before the target). First-move traps: 0 everywhere (5 slots forgive any first
  tap; the traps sit later). Munchers per level: 5–72.
- Every level replays its stored solution to a win; the independent audit's own rules agreed
  with `src/core` on 3,963 random boards and with the solver on 551 levels.

## Measured (Epic 3, 2026-10-19)
- Layout (design px): 9:16 → snack 896, slot 150, front muncher 123, queue 6 places; 20:9 → 12
  places; 1:1 → snack 512, 4 places; 16:9 → snack 880, 7 places. Cells ≥ 22 px everywhere.
- Rapid taps through level 26 (37 taps) and 70 settle with no muncher left on screen at the win.
- Hidden behind "+N" at level start: 47 % of munchers on 9:16, 37 % on 16:9, 68 % on 1:1, 3 % on
  20:9 (open question below).

## Reviews and audits
- Epic 1–2 `code-review`: 15 findings, all fixed or documented (late save merge, face colours
  vs snack colours, outline holes, planning-peak ranking, lane-count stream, purity lint,
  performance, tests for `markInteractive` and the pause gate); docs/questions.md.
- Epic 1–2 adversarial audit: 0 KRİTİK, 0 YÜKSEK, 1 ORTA, 8 DÜŞÜK — all closed
  (docs/questions.md): light snacks on breathers, 1000-playout metrics, 200 seeds per band
  (found and fixed an empty-lane edge in dealing), Title press rule, lint, `.gitattributes`.
- Epic 3 `code-review`: 15 findings, all fixed (queue shown deep with "+N", presses cleared by
  a pause, resize storms, allocation-free playback, tween/timeline clocks, lazy queue views,
  debug code out of production, constants, layout over every size). Two more bugs found on
  screenshots and fixed test-first: munchers keyed by slot (ghosts at the win), and killed
  fade-ins leaving queue munchers invisible.
- Epic 3 adversarial audit: 0 KRİTİK, 2 YÜKSEK, 4 ORTA, 5 DÜŞÜK — YÜKSEK and ORTA closed with
  red-first tests (invisible seated muncher after fast taps; Title not re-laid out after a
  rotation; front-first hit rule; retry keeps the level; screen-vs-rules e2e), DÜŞÜK closed or
  recorded (docs/questions.md). Its own model of the scene matched the rules in 1,800 runs.

## Hasan's steps (outside the code)
- [ ] Turn on GitHub Pages once: https://github.com/kriptoloca/munch-pixels/settings/pages →
      Source: "GitHub Actions" (a private repository needs a paid plan; otherwise make it public).
      Until then the Pages run builds and skips the deployment with a warning.
- [ ] Then on the phone: https://kriptoloca.github.io/munch-pixels/test/?reset=1 — play levels
      1–10 (and `?level=20`, a planning peak). Tell me: is it readable (pixels, the queue digits),
      do the taps land, is anything confusing, too easy or too hard? Does the "+N" (munchers not
      shown yet in long queues) bother you, or is the visible depth enough? Graybox look: discs
      and digits now; the munchers' faces, sounds and juice come in Epic 4.

## Next steps (in order)
1. Epic 4 feel and art (TASKS.md): muncher textures with faces, the bite stream juice (pitch,
   crumbs, belly), full-meal hit stop and kick, combo step, chain wake, waiting face, nope,
   win reveal, stuck faces, synthesized sounds, haptics; feel unit tests and the e2e feel log.
2. Epic 5 platform, boosters (+1 slot, undo) and ads; Epic 6 Title, brand, store, release.
3. After Hasan's phone check: tune the band targets and decide the open questions (queue depth
   vs lane length, difficulty for people).
