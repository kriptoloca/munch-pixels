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


## 2026-10-21 (session plan for Epics 4–6: decisions D1–D15)

The plan in docs/PROGRESS.md ("Session plan (2026-10-21, Epics 4–6, agent team)") took these
decisions where the docs leave a value or a behaviour open. Each rests on the lines named.

- **D1** Combo base pitch: `COMBO_CENTS_PER_STEP = 100`; a bite plays at
  `100 × min(n − 1, 12) + 100 × step` cents. Rests on GDD.md:86–87 ("Combo step … raises the
  full-meal kick and the base pitch of the bites", no value).
- **D2** Bite pitch "cap 12": from the 13th bite of a meal on, the pitch stays at +1200 cents.
  Rests on GDD.md:75 (bite row: "+100 cents per bite of this meal (cap 12)").
- **D3** Hop "pitch by colour index" = the palette index (`PALETTE` order), so a colour hops at the
  same pitch in every level; `HOP_CENTS_PER_COLOUR = 100`, wrapped in an octave. Rests on
  GDD.md:74 (hop row: "`hop`, pitch by colour index").
- **D4** Squeezed actions: an action played `fast` gets no hit stop, no kick, no haptic and at most
  one sound of a kind per frame (the plan: "at most one bite tick per frame"); its flight, crumbs
  and counter still play. Rests on GDD.md:92–97 (a new tap squeezes earlier playback "so the new
  muncher never waits").
- **D5** Cascade per input 0.5–2 s applies to taps that end in a full meal. Rests on GDD.md:88–90.
  Measured for the plan with Epic 3 timings: 0.72–3.02 s, median 1.00 s, 98.6 % inside over the
  3,723 taps of the stored solutions; 445 taps (12 %) end without a full meal (384 a hop alone).
  Re-measured with Epic 4's real exit below.
- **D6** The win smile: the face blinks once and its mouth is redrawn as the grin variant (a
  `drawFace` option: same seed, only the mouth cells change). Rests on GDD.md:37 ("it smiles"),
  GDD.md:110–111 ("smiles when the snack is gone") and GDD.md:81 (win row: blink and grow).
- **D7** Undo: every bite of the undone tap flies back, chain bites included, munchers that left
  reappear, then the screen is redrawn from the rules. Rests on GDD.md:84 (undo row) and
  GENERATOR.md:79–80 (`undo()` restores the whole state before the last tap). Epic 5.
- **D8** Lose panel: retry (big) and +1 slot, no undo there; the `slot` booster is one per level,
  from its button or as the panel's continue. Rests on GDD.md:162 (screen 5). Epic 5.
- **D9** Pause menu: freezes the scene and pauses the music, its own clicks still sound; opens
  over the lose panel, never over the win panel. Rests on GDD.md:98–99 and GDD.md:163. Epic 5.
- **D10** Interstitial: only on the win panel's continue tap, never after a loss or a retry;
  `AdGate.onSceneCompleted()` on every win; one gate per session on `performance.now()`. Rests on
  GDD.md:139–141, GDD.md:160–161 and CLAUDE.md:39–43 (rule 6). Epic 5.
- **D11** Share: the win panel's share button is excluded from "tap anywhere"; a 1080×1080 PNG of
  the revealed face with the level number and the wordmark; the text is one string without a URL;
  hidden on YouTube; after a refused share and a refused download the button hides for the
  session. Rests on GDD.md:118–122, GDD.md:160 and CLAUDE.md:49–50 (rule 9). Epic 6.
- **D12** "Screenshots in three aspects": 1080×1920, 1080×1080 and 1920×1080. Rests on TASKS.md:69.
  Epic 6.
- **D13** First upload as version 0.1.0, so the ZIP is `release/munch-pixels-0.1.0.zip`. Rests on
  briefs/munch-pixels.md:98 (M3) and package.json (0.0.1 today). Epic 6.
- **D14** The synthesized placeholder sounds and loop ship to the sandbox; real files drop into
  `assets/audio/` later without code. Rests on briefs/munch-pixels.md:117 ("an art pass after the
  first sandbox numbers") and GDD.md:174–177 (§11 "Synthesized placeholders like Peek & Find").
- **D15** Dev-only test switches (Peek & Find patterns): `?feelslow=K` stretches every feel timing
  K times, `?adfast=1` starts the session's AdGate 120 s back, `?fakeads=fail` makes fake rewarded
  ads fail. Rests on docs/PROGRESS.md:43–44 (dev parameters only inside `import.meta.env.DEV`) and
  briefs/munch-pixels.md:70 (`?fakeads=1`). `feelslow` built in Epic 4; the others in Epic 5.

## 2026-10-21 (Epic 4: feel and art, M2, as built)

- **One clock for the juice.** The scene clock, the timeline and every pooled effect (flights,
  crumbs, puffs, confetti) run on `clockScale` (1 / feelslow; 0 inside a hit stop); the tweens on
  `tweens.timeScale`, set together. `hitStop(ms)` is the one function: it zeroes both, restores
  them on a wall-clock timer, never starts under a pause, and a pause inside it stays frozen
  after the restore (the pause has its own switches). `?feelslow=K` scales both rates, the stop
  and the kicks, so a whole cascade can be watched or tested in slow motion. The camera kick runs
  on the game loop: a pause resets it (`resetFX`).
- **Ticks sound when the pixel lands** (the counter drops with the tick: counting along), so the
  last bite's +2 dB tick, the full meal's hit stop and the kick land on one frame. Flights start
  at their scheduled time, so a flight and its meal's `full` meet exactly.
- **D1 in practice: a meal's base pitch is latched when its eating run starts** (the hop or a
  wake). The combo is fed by the full and wait actions as they play (played order equals rules
  order for fulls and waits); latching keeps "each bite 100 cents above the last" inside a run
  even when an earlier muncher's full lands mid-run in a chain.
- **The hop's squash is its take-off**, relaxing over the first 80 ms of the 220 ms arc, then a
  landing squash: the timeline's HOP_MS still marks the landing, so the first bite still leaves
  as the muncher lands (GDD values kept, no extra delay per tap).
- **The full meal's exit** is the 45 ms stop, a 120 ms belly bounce (1.2×, up and back) with the
  smug face, the burp and its puff at the top of the bounce, then the 300 ms waddle (rising,
  rocking, fading). The burp runs on its own timer: the full-meal e2e found that a tap right
  after a cascade drained (the next muncher hopping into the same slot hurries the old one off)
  cut the burp from the bounce; fixed red-first.
- **The stuck beat is scheduled by the timeline**: one `stuck` action per seated muncher, slot by
  slot, STUCK_STAGGER_MS apart from the last sit-down, the `lost` panel STUCK_MS after the first.
  Face turns on tween timers drifted against the scene clock under load (an e2e caught it); on
  the timeline they are exact, testable without Phaser, and a redraw lands on the stuck faces.
  Epic 5's `cancelLost()` drops these with the `lost`.
- **The lose panel slides up** in PANEL_SLIDE_MS (250 ≤ the 300 ms press guard); the win panel
  appears in place with the reveal.
- **The blink** (D6) shuts each eye with whites to a dark lid line across the eye's whole width
  on its eye row; eyes that are all dark already (dots, sleepy lines) vanish into the head for
  the blink, otherwise a fifth of the faces would not visibly blink. The drawing records the
  cells eye by eye, so a centred cyclops eye shuts as one eye (audit fix: grouping by the side of
  the centre split it, so it vanished on odd widths and kept a two-of-three lid on even ones;
  `tests/face.test.ts` › "every eye with whites shuts to a lid as wide as the eye"). A
  fingerprint test proves the default faces are unchanged.
- **Muncher art** (`src/game/muncher-art.ts`, pure shapes; SVG for Epic 6's icon): one body per
  palette colour whose fill is exactly the palette colour (a darker outline of its own colour,
  shade, belly patch, highlight, feet baked around it; the ink body keeps its light ring and gets
  light features), seven shared overlays: idle, eating, waiting (mouth open, eyes up), waking (eyes
  wide), full (smug, half lids), stuck (eyes down, sad brows) and **queue** (eyes only). Not
  baby-faced: brows tilted in, hooded eyes, a fang, eyes high and not oversized. Eye whites carry
  an ink ring (the cream body lost its eyes without it). **Deviation:** the seventh overlay, so a
  queued muncher shows its eyes and a digit at 0.55 of its size (34 design px on 9:16; the
  graybox had 26) instead of a full face with a digit too small to read.
- **MuncherView moved** from GameScene.ts to `src/game/muncher-view.ts` (deviation from the plan's
  file list: the scene grew past 1,200 lines with the juice; the view is its own unit now).
- **Pools** (`src/game/fx.ts`): flights 8, crumbs 24, puffs 9, confetti 36, created with the board
  and reused; the per-frame update allocates nothing, the bite path writes into scratch points
  and one scratch sound-options object (audit fix: each landing used to allocate its
  `{ detune, db }`; a play without options shares one frozen empty object;
  `tests/source-rules.test.ts`), and the bite tick (14 a second) plays from 4 reused sound
  instances. A long level played at the normal pace grows no pool (e2e).
- **Sound levels.** Peek & Find's lesson repeated itself: soft failure tones have a low crest
  factor, so with every file normalized to one peak the nope, wait and stuck files measured louder
  than the clicky bite. The success files are now dense (bite, burp, win) and the failure files
  sparse; gains: hop 0.6, bite 0.7, burp 1, perk 0.7, wait 0.55, nope 0.5 (GDD), win 1, stuck 0.6
  (GDD), pop 0.8, undo 0.7, button 0.6. As played: full meal −12.4 dB, win −13.6, nope −24.0
  (the quietest), wait −22.4, stuck −21.7, a lost tap's wait + stuck −19.0.
- **`npm run audio:check`** (CI) checks the committed `public/audio` against the manifest (every
  sound in both formats, the index, the budgets) and checks that every file runs as long as its
  source (ffprobe; CI installs ffmpeg). Encoding needs ffmpeg 6.1.1 and is not byte-stable across
  ffmpeg versions (as in Peek & Find), so CI checks presence, budgets and durations, and
  `tests/audio.test.ts` measures the levels (`SFX_FILE_DB`, ±1 dB). Audit fix: ffmpeg reads
  every source by its path with `-xerror` (`scripts/lib/encode.mjs`); through a pipe, a drop-in
  M4A with its index at the end came out as a silent 3 KB stub while ffmpeg reported success,
  and a cut source as a short file (`tests/audio-encode.test.ts`). Re-encoding the placeholders
  this way gives byte-identical files.
- **D5 re-measured with Epic 4's exit** (`cascade()` in `src/game/timeline.ts`, hit stops
  counted): taps that end in a full meal run 0.89–3.37 s, median 1.17 s, 97.7 % inside 0.5–2 s.
  At the capture's pace (each tap when the cascade drained) the longest stretch without a finish
  over all 100 levels is 3.3 s (level 53).
- **The capture anchors on the win.** Playwright's screencast lags the page under load and drops
  what is still queued when the page closes, so "the last 10 s of the video" missed the win. The
  script keeps the page open 6 s past the win, finds the first frame showing the win panel's
  button in the video and cuts 10 s ending 1.5 s after it; the feel log maps through the same
  anchor.
- **Music on the first game tap** when a dev URL skips the Title (`?level=20` for the phone
  check); in production the Title's play tap starts it, as planned.
- **Task 4 design gate, done by the coder** with `design:design-critique` and
  `design:accessibility-review` on 9:16, 1:1 and 16:9 shots of levels 1, 20 and 70 (the gamer's
  own gate stays with the team): the snack draws the eye first, then the front munchers, then the
  queues; no baby look. Digits: white on a #1b1f2a stroke, 16.5:1, on every body. The plan's close
  pairs under normal vision (CIE76): red/maroon 35, red/pink 49, maroon/pink 44, green/lime 36,
  cyan/blue 67, sand/yellow 31, sand/cream 41, yellow/cream 66; under simulated deuteranopia and
  protanopia all ≥ 17.8. The pairs that collapse for dichromats, blue/purple (deutan 9, protan 5)
  and brown/maroon (deutan 10), never share a level (0 of 100); orange/yellow (deutan 19) shares 9
  levels and red/maroon (protan 18) 6, carried by lightness. Recorded, not changed: the maroon,
  brown and ink bodies are dark on the slot (1.5–2.1:1); their eyes, digits and the ink ring carry
  the silhouette. 1:1 queue munchers are small (the digit stays ≥ 30 design px, tested).
- **No new dependency.** ffmpeg (system) for `npm run audio`, `npm run audio:check` (ffprobe),
  the audio tests and `npm run capture`.

## Open questions (defaults in force)

- Final name — default "Munch Pixels" (working title); check stores and portals before the
  listing.
- Colour-blind support — default distinct hue + lightness; shape marks if testers struggle.
  Epic 4 data (task 4 gate): the two pairs dichromats lose (blue/purple, brown/maroon) never share
  a level; the belly patch has room for a shape mark if Hasan's testers report trouble.
- After level 100 — default: the last level repeats in v0.1; endless seeds in v0.2.
- How hard is hard for a person? The difficulty signal is a random tapper; a careful (greedy)
  player wins most levels (≈ 90 % in the first build). Default: keep the bands as built and the
  planning peaks; after M1 Hasan plays levels 1–30 on the phone and we move the band targets if
  the game feels too easy or too hard (no human data before that).
