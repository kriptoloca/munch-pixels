# Decisions and open questions

Every deviation from the spec, every assumption, with the reason. Newest at the bottom.

## 2026-10-19 (plan; Hasan: "plan step by step, completely, then start coding")

- **Origin.** Idea A of `peek-and-find/reports/2026-10-19-ideas-next-game.md`: the pixel-eating
  colour sort (Food Hunt: Pixel Puzzle and Colony Flow! on the September 2026 trending chart) with
  our face (munchers, hidden faces) and our fairness (solver-proven levels). Hasan approved
  building it; the repo is `kriptoloca/munch-pixels`.
- **Skills used for the plan:** `game-trend-skills:writing-game-agent-briefs` (briefs/munch-pixels.md),
  `pebblit-game-craft` workflow A (Face 4, Feel 5; Feel spec in GDD §3a), the brainstorm and its
  evidence from `brainstorming-game-ideas`. Mapped for later steps in `docs/skills.md`.
- **Reuse from Peek & Find** (same versions, copied and adapted, not shared as a package yet):
  Bridge wrapper, storage, ad gate, haptics, iOS unmute, host detection, resume grace, scale
  strategy, audio synth pipeline, audit/zip/size/version scripts, Playwright setup, CI. The
  `writing-game-agent-briefs` rule: a shared package only after a second game needs it — this is
  the second game, so extracting `@pebblit/platform` is a candidate after v0.1 ships, not before.
- **Fixed level list, the same for every player** (no per-player salt). Retry replays the same
  level. Lesson from Peek & Find v1.9: per-player dice made "level 37" mean different things.
- **No hearts, stars or timer** in v0.1: a loss costs nothing but a retry; the slots are the only
  pressure (Flow pillar: tension saved for a few moves).
- **Bites fly to the muncher in its slot** instead of the muncher walking over the picture: no
  path-finding, and it reads like Bus Fever's boarding (units entering one by one).
- **Levels prebuilt** (`src/data/levels.json`) instead of generated at runtime: the build runs
  the metrics (hundreds of playouts per candidate) once; the game loads a small JSON.
- **Hidden faces are procedural** (one per level, from parts) instead of hand-drawn joke pairs:
  every level gets its own face at no content cost; hand-drawn joke pairs (apple → worm) are a
  v0.2 candidate.

## Open questions (defaults in force)

- Final name — default "Munch Pixels" (working title); check stores and portals before the
  listing.
- Colour-blind support — default distinct hue + lightness; shape marks if testers struggle.
- After level 100 — default: the last level repeats in v0.1; endless seeds in v0.2.
