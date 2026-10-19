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

## 2026-10-19 (Epics 1–2: rules and content pipeline)

- **"No free slot" never reaches the player, so the nope moved.** After every resolve, full slots
  with munchers still in the dens are a loss, so a playing level always has a free slot (property
  test over 2000 random levels in `tests/core-props.test.ts`). `Game.check` keeps `no-slot` as a
  guard only. The soft failure the Feel spec wanted now goes to the tap a player can actually
  make wrong: a muncher behind the front shakes its head (`nope`, 8 ms), and its lane's front
  bobs to show which one to tap (GDD §3 and §3a updated; `pebblit-game-craft`: failure stays
  local and soft).
- **Animation runs on a timeline, the rules resolve at once (decided for Epic 3, built as
  below).** The rules return all events of a tap immediately; the scene plays them back in order
  and input stays open, so the player never waits on an animation.
- **The outline (`d`, ink 0x161a26) from level 4 on.** Without it the generated levels were too
  easy to be a game: a random tapper won almost every one (average random win ≈ 1 in the first
  build), because every colour was exposed from the start. A one-pixel outline buries every
  inner colour until it is eaten through, so the order of taps starts to matter. It also reads
  as a sticker edge around the snack. Levels 1–3 keep the bare snack (teaching).
- **Runs in the dealing (`runChance`).** The second lever: a planned muncher may queue behind the
  previous one, so the other lanes' fronts belong to later moves (the traps). Together with the
  outline the band averages of difficulty now rise from 0.10 to ≈ 0.5 (PROGRESS.md).
- **Bands differ from the first GENERATOR §6 table:** an outline column, `runChance` per band,
  band 5 appetite 2–6 (smaller munchers, more taps, more decisions), no snack size/colour column
  (the snack order decides it). GENERATOR §6 now holds the table as built.
- **Second round for levels that stay too easy, and planning peaks.** The first build left 30 of
  100 levels outside their target, most of them below it (snacks with 3 colours: cheese, cookie,
  strawberry, at 0.05–0.15 in bands 4–5). A level whose best candidate is below the target now
  gets 24 more seeds with harder dealing (`escalate`). From level 20 every 10th level prefers a
  candidate the greedy player loses: a few levels ask for planning (Flow pillar: tension saved
  for a few moves).
- **Board colour `0x4a5472`** (slate): every snack colour and the dark outline read against it;
  pure black would swallow the outline.
- **`Game.append` and `Game.clone`.** The generator plans by growing one lane while it plays it
  on the real rules (append, not undoable), and the solver and playouts search on clones without
  the undo history; replaying from scratch for every node was slow. Both are covered by tests.
- **`sharp` stays a dev dependency** (copied from Peek & Find): the Epic 5 e2e that checks the
  pause dim measures screenshot pixels with it. No other use.
- **`firstMoveTraps` is 0 on every level** with 5 slots (no first tap can lose yet); the traps sit
  later. Kept as a metric for levels with fewer slots; difficulty rests on the random win rate
  and the greedy player.
- **Epic 1–2 code review (2026-10-19), closed:** a late save read is merged instead of being
  overwritten (`mergeSaves`, `adoptLateSave`; settings come from the stored save, the furthest
  progress wins); the hidden face moved to a muted family at least ΔE 18 from every snack colour
  (the old one reused cream, red and pink exactly, so revealed eyes looked like pixels left to
  eat), and uneaten pixels render as raised tiles (GDD §4); the outline no longer inks enclosed
  holes (the donut keeps its hole); planning peaks rank a greedy loss before the target
  distance; the lane count has its own random stream (it was tied to the first planned wait);
  player-only undo snapshots and shared open ground make the level build faster; the purity
  lint also bans `Date`, `crypto` and timers; `bindPauseGrace` and `markInteractive` are
  tested. The band appetite range is a target, documented in GENERATOR §3.
- **Epic 1–2 adversarial audit (2026-10-19): 0 KRİTİK, 0 YÜKSEK, 1 ORTA, 8 DÜŞÜK; all closed.**
  Its own rules implementation agreed with src/core on 3,963 random boards (158,520 actions,
  0 mismatches), the solver agreed with brute force on 551 levels, every level replays to a win.
  - ORTA, difficulty fell from levels 61–70 to 71–80: the snack cycle put the light snacks
    (apple, cheese, strawberry, cookie…) on hard levels, where even harder dealing cannot lift
    them. Now the light snacks only come on breather levels after level 30 (`LIGHT_SNACKS`), and
    a test bounds the dip of the 10-level moving average.
  - The stored difficulty was a 120-playout estimate (±0.045); stored metrics now use 1000
    playouts (±0.016) while the search keeps the quick estimate.
  - 200 seeds per band in the generator test (it ran 40); it found a real edge: runs could leave
    a lane empty on a small snack (the build retried another seed). Dealing now gives every empty
    lane one of the last munchers.
  - The Title's play button acts only on a press that began on it while input was on (a press
    held through a pause no longer starts the game); the Game's panels got the same rule.
  - Purity lint also bans `node:*`, `crypto`, `perf_hooks`, `timers` imports and `globalThis`;
    `.gitattributes` keeps LF so `levels:check` holds on Windows checkouts; a property test mixes
    taps, undos and +1 slot against a replay; GENERATOR §3 and §7 document the appetite edge
    and that the face ignores the snack's outline (it shows whole at the win).
- **Storage load has a 4 s timeout** (`LOAD_TIMEOUT_MS`): a host storage call that never settles
  would otherwise hold Boot and GameReady forever; the game starts with a fresh save instead.

## 2026-10-19 (Epic 3: graybox loop, M1)

- **The timeline, as built (`src/game/timeline.ts`).** One tap's events play in their own order
  (hop; bites 70 ms apart once it landed; a chain wake after the bites that opened it; a leave
  or wait when its last bite landed; win and lose after everything plus their beat). A new tap
  first squeezes everything still pending from earlier taps into 150 ms, keeping the order, so
  causality holds across taps (no pixel leaves before the one that uncovered it) and the new
  hop starts at once. Simpler and safer than per-slot timelines, which can show a pixel
  leaving before its cover; the cost is that fast tapping shortens earlier bite streams, which
  is what an impatient player asks for.
- **Slot actions name their muncher (`who` = lane:index).** Found on a screenshot of rapid
  taps: a new muncher could sit in a slot (rules) while the previous one was still leaving on
  screen; the old muncher's squeezed "full" then sent the new one away, and ghost munchers
  stayed on the win screen. The scene now keys views by muncher, not by slot; a timeline test
  and the rapid-tap e2e (no views left at the win) guard it.
- **Panels and the Title act on a press that began on them** (a press from before the panel
  opened, or held through a pause, never counts).
- **Pause in Epic 3 already freezes** the scene clock and every tween and gates input
  (`bindPauseGrace`); the dim overlay and the pause menu stay in Epic 5.
- **Graybox look:** discs in the snack colours with the remaining appetite as a digit and a
  light ring (ink munchers vanished on the dark page without it); uneaten pixels as bevelled
  tiles (8 canvas px per cell, NEAREST), the face flat under them. Art in Epic 4.
- **Deep queues show small, the rest as "+N"** (code review, Epic 3). GDD §2 says every queue is
  visible, but lanes run up to 18 munchers (median longest lane 11), and full-size munchers fit
  2–4 deep. The front muncher is full size; the queue behind it shows as half-size munchers as
  deep as the screen allows (at least four places per den on every screen, six on 9:16, up to
  twelve), and a "+N" chip counts the rest. The planning a level asks for stays within the
  visible depth in practice; whether the generator should cap lane length to it is an open
  question for after the phone check (default: no cap).
- **Layout arrangements:** portrait bands from H/W ≥ 1.5, the split landscape from W/H ≥ 1.6,
  the square arrangement in between (a layout test sweeps every design size in 40 px steps).
- **Clocks:** the tweens skip a stall over 200 ms as one 33 ms frame (`setLagSmooth`); the scene
  clock gets Phaser's smoothed delta, which already replaces such a stall with an earlier frame
  (the guard in `update` is a backstop). Either way a host hitch cannot run the flights far
  ahead of the bites.
- **Debug hooks live in `src/dev/game-debug.ts`**, loaded by a dynamic import in the scene's DEV
  branch; the production scripts are checked not to contain them (smoke.spec).
- **Epic 3 `code-review` (15 findings) and adversarial audit (0 KRİTİK, 2 YÜKSEK, 4 ORTA,
  5 DÜŞÜK), closed:**
  - YÜKSEK: fast taps on one lane could leave a seated muncher invisible (a fade-in killed every
    frame never progressed); whatever moves is now drawn at full alpha at once, and the e2e
    compares the settled screen with the rules (digits, alpha, places, amber frames, dens,
    "+N") after rapid taps in 1:1 and a true 9:16.
  - YÜKSEK: the Title did not re-lay out on resize (the play button left the screen after a
    rotation); it now does, with an e2e that rotates and plays.
  - A point inside a front muncher's circle is always the front (`pickDen`, unit-tested); the
    first queued muncher's circle used to steal its lower edge for a nope.
  - Retry replays the level just lost (`restart({ level })`), even if a late save read moved
    the progress; next follows the progress.
  - A resize under a pause waits for the resume; the nope shake is two 40 ms swings; panels
    sit over the dens (the stuck slots and the face stay above the dim); a 250 ms guard after a
    level starts and 300 ms after a panel opens stop a double tap from skipping the reveal or
    playing the next level's first move.
  - The pause e2e also proves nothing on screen moves (not only the timeline); it fails
    without `tweens.pauseAll()`.
- **"+N" uses a plus sign:** a symbol, not a word (nothing to translate), next to digits, which
  CLAUDE.md rule 8 allows; the same family as the play triangle and the retry ring.
- **Hidden part of long queues, measured (open question for the phone check):** at level start
  the "+N" chips hold 47 % of all munchers on 9:16 (93 of 100 levels), 37 % on 16:9, 68 % on
  1:1, 3 % on 20:9 (most current phones). They come into view as the queues move. Options if it
  hurts on the phone: cap lane length in the generator to the visible depth (fewer, larger
  appetites), or two queue columns per den in Epic 4. Default until Hasan's check: as built.
- **For Epic 5:** a pending `lost` action cannot be cancelled; a +1 slot bought during the
  600 ms stuck beat must clear it (or the lose panel would open on a level playing again).
- **The Pages workflow moved from Epic 6 to Epic 3** (`.github/workflows/pages.yml`, ported):
  M1 needs Hasan's phone check, and the `/test/` build carries the dev shortcuts.


## Open questions (defaults in force)

- Final name — default "Munch Pixels" (working title); check stores and portals before the
  listing.
- Colour-blind support — default distinct hue + lightness; shape marks if testers struggle.
- After level 100 — default: the last level repeats in v0.1; endless seeds in v0.2.
- How hard is hard for a person? The difficulty signal is a random tapper; a careful (greedy)
  player wins most levels (≈ 90 % in the first build). Default: keep the bands as built and the
  planning peaks; after M1 Hasan plays levels 1–30 on the phone and we move the band targets if
  the game feels too easy or too hard (no human data before that).
