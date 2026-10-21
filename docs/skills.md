# Skills in this project

Which enabled skills apply to Munch Pixels, at which step. Scanned 2026-10-19 against the
session's skill list.

## Use at these steps

| Step | Skill | What it does here | Status |
| --- | --- | --- | --- |
| Idea choice and market evidence | `game-trend-skills:brainstorming-game-ideas` (+ `scanning-game-trends`, `evaluating-game-ideas`) | The idea card and its live evidence (`peek-and-find/reports/2026-10-19-ideas-next-game.md`) | done 2026-10-19 |
| Build brief | `game-trend-skills:writing-game-agent-briefs` | `briefs/munch-pixels.md`: hypothesis, non-goals, rules, pipeline first, milestones | done 2026-10-19 |
| Design, feel, polish, phone feedback about feel | `pebblit-game-craft` | Face/Feel scores, the Feel spec (GDD §3a), the feel audit when something "isn't fun" | in use |
| Every epic end | `code-review`, then an independent adversarial audit subagent | Correctness first, then rules, fairness and platform; KRİTİK/YÜKSEK closed before the push | every epic |
| Cloud sessions can build and test | `session-start-hook` | A SessionStart hook (`.claude/hooks/session-start.sh`, cloud only) that runs `npm install` so a fresh cloud session can run check/test/e2e; `npm install` rather than `npm ci` so the cached container keeps `node_modules` | Epic 0 |
| See the change in the real app | `run` | Launch the dev build and screenshot it when a test is not enough | as needed |
| Store listing text | `design:ux-copy` | Listing, how-to-play, 13+ wording | Epic 6 |
| Logos, icon, thumbnails | `canvas-design` (+ `scripts/thumbnails.mjs` pattern from Peek & Find) | Original marks; real gameplay thumbnails | Epic 6 |
| Visual pass | `design:design-critique`, `design:accessibility-review` | Colour distinctness (colour-blind risk), contrast, layout | Epic 4 gate done 2026-10-21 (docs/questions.md); Epic 6 |
| Launch plan | `game-trend-skills:launching-on-zero-budget` | Playgama sandbox, free share-bonus run, community post, YouTube Playables | Epic 6 |
| After launch | `game-trend-skills:tracking-game-metrics`, `product-management:metrics-review` | Kill / iterate / scale against the brief's targets | post-launch |
| Submission day | `engineering:deploy-checklist` | Walk the certification checklist before the upload | Epic 6 |

## Not for this project

- `dusman-denetci`, `restore-safety`, `ikas-api`: the GeriAl (ikas) project's rules; the audit
  here is the same pattern as Peek & Find (independent subagent against GDD/GENERATOR/CLAUDE.md).
- `product-tracking-skills:*`: no external calls allowed; analytics stays local.
- `unity:*`, `unreal-engine-*`: other engines.
- Document, office, finance, sales, marketing-automation and CRM skills: no step needs them.
