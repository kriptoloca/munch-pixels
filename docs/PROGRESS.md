# PROGRESS.md — where we are

Single source of truth for "where did we leave off". Read first at the start of every session;
update at the end of every epic.

## Status
Epic: 3 (graybox loop) next · Epics 1–2 done 2026-10-19 · Last update: 2026-10-19 · Branch: main
Repo: https://github.com/kriptoloca/munch-pixels

## Session plan (2026-10-19)
Hasan: "plan step by step, completely, then start coding; scan all skills and use the needed ones."
- [x] Plan: GDD.md (+ Feel spec §3a), GENERATOR.md, briefs/munch-pixels.md, CLAUDE.md, TASKS.md,
      docs/questions.md, docs/skills.md, this file.
- [x] Epic 0: scaffold, pipeline, platform layer, CI, smoke e2e, SessionStart hook.
- [x] Epic 1: core rules with the worked examples.
- [x] Epic 2: content pipeline, 100 levels (M0).
- [ ] Epic 3: graybox loop (M1).
- [ ] Epics 4–6: feel and art, platform and boosters, release.

## Epic board
| Epic | Scope | Status | Evidence |
| --- | --- | --- | --- |
| 0 | Scaffold, pipeline, platform layer | done | toolchain and platform layer ported from Peek & Find (same versions); save model, analytics (local), haptics kinds; 23 unit + 3 e2e; CI; `.claude/hooks/session-start.sh` (npm install in cloud sessions); review and audit folded into Epic 1's |
| 1 | Core rules | done | `src/core`: open ground, exposure, reachable order, resolve with events, won/lost, +1 slot, undo, replay; the four worked examples; property tests (2000 random levels: lost only with full slots, a free slot while playing, all out ⇒ won; 1000 mixes of taps, undos and +1 slot equal a replay); `Game.clone`/`append` for the generator and solver |
| 2 | Content pipeline (M0) | done | 30 snacks, palette (outline ink `d`), seeded generator with runs and planned waits, exact solver, metrics, procedural faces (dusty palette, ΔE ≥ 18 from every snack colour); `npm run levels` → 100 levels in ≈ 2 min, `levels:check` reproduces them byte for byte (CI step); measured numbers below |
| 3 | Graybox loop (M1) | planned | |
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

## Reviews and audits
- Epic 1–2 `code-review`: 15 findings, all fixed or documented (late save merge, face colours
  vs snack colours, outline holes, planning-peak ranking, lane-count stream, purity lint,
  performance, tests for `markInteractive` and the pause gate); docs/questions.md.
- Epic 1–2 adversarial audit: 0 KRİTİK, 0 YÜKSEK, 1 ORTA, 8 DÜŞÜK — all closed
  (docs/questions.md): light snacks on breathers, 1000-playout metrics, 200 seeds per band
  (found and fixed an empty-lane edge in dealing), Title press rule, lint, `.gitattributes`.

## Hasan's steps (outside the code)
- [ ] Nothing yet. After M1: open the `/test/` link on the phone and play five levels.

## Next steps (in order)
1. Epic 3 graybox loop (TASKS.md): layout, Game scene with the snack texture and the playback
   timeline, win/lose panels, progress, e2e through real taps, Pages link for the phone.
2. Epic 4 feel and art, Epic 5 platform and boosters, Epic 6 release.
