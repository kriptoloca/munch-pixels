# Munch Pixels: core rework spec (Epic 4R)

Status: proposal, 2026-10-21; not started (Munch Pixels paused the same day, docs/questions.md).
The scratch scripts named below were not kept; their method and results are recorded here. Author: lead designer (agent team). Readers: coder, auditor,
playtester, Hasan. Nothing in the repository was edited for this spec.

Inputs:
- Playtest 1 (graybox, commit 4f6ebfa) and playtest 2 (the uncommitted Epic 4 build).
- CLAUDE.md, GDD.md, GENERATOR.md, briefs/munch-pixels.md, docs/questions.md, `src/core`, `src/gen`.
- The `pebblit-game-craft` skill (Face, Feel, Flow, Fair, Share).
- The genre notes in `peek-and-find/reports/2026-10-19-ideas-next-game.md`.

Evidence was produced in scratch, not in the repo:
- Verification scripts against the real rules and the real level list:
  `/tmp/claude-0/-home-user/51a2a0b8-3419-510d-925c-5e99d54b36ba/scratchpad/core-rework/verify/`
- A prototype of the new generator, run on a copy of `src/core` with one switch for the eating
  order: `/tmp/claude-0/-home-user/51a2a0b8-3419-510d-925c-5e99d54b36ba/scratchpad/core-rework/proto/`
- Outputs of both: `/tmp/claude-0/-home-user/51a2a0b8-3419-510d-925c-5e99d54b36ba/scratchpad/core-rework/out/`

The platform hard constraints, the purity and determinism rules of CLAUDE.md and "every level is
solver-proven without boosters" all stay as they are. Section 16 lists the decisions to record
in `docs/questions.md`.

---

## 0. The rework in one page

The game is not fun because nothing in it is a decision. That comes from three things:
- Five slots forgive every order.
- The generator deals a solution that never needs a muncher to wait.
- The levels were tuned against a random tapper.

Two smaller problems sit on top. Taps are crumbs (4.6 pixels each). The one rule cannot be seen,
because buried pixels look like exposed ones and a black outline hides everything.

Simply raising appetites and cutting slots does **not** fix this. The prototype measured that a
player who can count wins about 100 % of such levels (§4.1). What decides difficulty is
**slack**: the slots a level gives, minus the fewest slots an exact search needs to win it.

The rework, in order of weight:

1. **Slots by measurement.** Every level's slot count is `minSlots + slack`. `minSlots` is the
   fewest slots the exact search needs, and it must be at least 2 from level 4, so waiting and
   chains are part of every solution. Slack is 0 on most levels and 1 on breathers. Players see
   3 slots in most levels and 4 in some.
2. **A new generator.**
   - The planner's munchers have appetites of 10–30, with 6–15 munchers per level.
   - They are dealt "dig-wall" style: inner colours towards the front of the lanes.
   - The exact search proves each level and stores its solution.
   - Candidates are chosen by **player models**, not by a random tapper. A skilled player wins
     85–95 % of normal levels early and 80–92 % late, and 50–70 % of peaks. A random tapper wins
     at most 35 % of normal levels and 10 % of peaks.
   - From level 11, every normal level must contain at least one decision that looks right and
     loses.
3. **New snacks.** Snacks with nesting and islands (shells, rinds, plates; seeds, sprinkles,
   chips) replace the near-black outline. They are what makes deep levels possible (§4.6).
4. **The rule made visible.**
   - Exposed pixels are raised tiles; buried ones are flat and recessed.
   - Front munchers look ready, peckish or sleepy.
   - Eaten cells are dark holes, with the face as a dark silhouette until the win.
   - A meal eats as one flood from its lowest reachable pixel.
5. **Hand-made onboarding.** Level 1 teaches the rule, a chain and the payoff in two taps.
   Level 2 adds a choice and the full-table threat. Level 3 is the first dig.
6. **Feel fixes on top of Epic 4** (playtest 2):
   - Meals play in parallel per slot, so fast taps no longer strip the juice. This replaces D4.
   - Phone-audible success sounds.
   - A win reveal that gets its own moment.
   - Hop anticipation, streaming flights, a combo that decays, blissful full munchers.

What stays: the verb (tap a front muncher), reachability with tunnelling through a muncher's own
colour, waiting and chains, exact appetite totals, the loss rule, the boosters, the playback
timeline, the pure core, the hit-stop machinery, pools and audio.

---

## 1. What I verified (independent re-measurement)

Method: my own bots and exact search, written from scratch, run against the repo's `src/core` and
`src/data/levels.json`. Both are identical to HEAD 4f6ebfa and to the playtester's snapshot. My
exact search agrees with `src/gen/solve.ts` on 151 sampled positions, with 0 disagreements.
Scripts: `verify/lib.ts`, `stats.ts`, `exact.ts`, `deep.ts`, `snacks.ts`, `squeeze.ts`.
Outputs: `out/stats.txt`, `out/exact-1-50.txt`, `out/exact-51-100.txt`, `out/deep.txt`,
`out/snacks.txt`.

### 1.1 Playtest 1 (core)

**No decisions**

| Claim | Measured (400 plays per level unless noted) | Verdict |
| --- | --- | --- |
| The "edge" bot (taps a front whose colour can eat) wins 98.3 % of levels 1–20 and 93.5 % of 21–100 | 97.8 % and 93.7 % | Holds |
| A random tapper wins 84.5 % of levels 1–20 | 84.7 % | Holds |
| "Prefer finishers, dig to the nearest visible eater" wins 99.5 % of all 100 levels, level 70 included | 99.5 % (depth 5); level 70: 100 % | Holds |
| Difficulty is tuned against a random tapper | `metrics.ts`: `difficulty = 1 − randomWin` | Holds |
| No tap along the stored solutions of levels 1–39 and 41–49 makes a level unwinnable | Critical turns: none in 1–39 and 41–49; 7 on level 40, 4 on level 50; 150 turns over 30 of levels 51–100 | Holds |
| On peaks the only traps are munchers that cannot eat yet | True on every level: 0 of 3,723 turns hold a losing tap whose muncher could eat | Holds, and stronger than claimed |

**Taps are crumbs**

| Claim | Measured | Verdict |
| --- | --- | --- |
| Appetites 1–11, median 5, 4.6 pixels per tap | 1–11, median 5; 17,233 pixels / 3,723 munchers = 4.63; only 12 munchers eat 10 or more | Holds |
| Levels 1–20 take 447 taps; levels 20, 40, 70, 100 take 33–52 | 447; 33 / 37 / 52 / 47 | Holds. All of 21–100 span 25–72, median 38.5 |
| Level 70 shows about 50 tiny discs on a 19.5:9 phone | 390×844: 12 places per den, all 52 munchers drawn; queue munchers 62 design px (≈ 22 CSS px). On 9:16, 47 % hide behind "+N" | Holds |

**The rule is invisible**

| Claim | Measured | Verdict |
| --- | --- | --- |
| From level 4 the near-black outline is the only exposed colour | 97 of 97 levels | Holds |
| Buried pixels look exposed; the face hides the holes | `GameScene.drawCell` draws every uneaten pixel as the same bevelled tile and every eaten cell in the face colour | Holds (code) |

**No onboarding, then a cliff**

| Claim | Measured | Verdict |
| --- | --- | --- |
| Levels 1–2 cannot produce a wait or a chain | Edge bot: 0 %. Exhaustive search: levels 1–3 can never be lost | Holds |
| The first wait comes at level 4–5 | Edge bot: level 3 already waits and chains in 53 % of plays; level 4 in 0 %, level 5 in 30 % | Off by one level |
| The first possible loss comes at levels 12–15 | Rule-following player: level 12 (4.8 %), level 15 (34 %). Any order: level 4 can already be lost (random tapper loses 10 %) | Holds for a player who taps eaters |
| Level 15, a breather, loses 36 % of careful players in a forced one-lane tail | 34.0 % over 800 plays (35.7 % over 300). Every loss: the last 1–2 taps had one legal lane, and the trap was a cannot-eat tap 3–4 taps before the loss | Holds |
| Level 70 beats the simple bot in about 5 taps, three times in four | 72 % losses, median 5 taps at the loss | Holds |
| In 116 of 134 taps of levels 1–10 every front could eat | One careful play per level: 115 of 134. Edge bot over 50 plays: 81 % of turns | Holds |

**Predictability and payoff**

| Claim | Measured | Verdict |
| --- | --- | --- |
| 23–68 % of a muncher's bites scatter | 0.23–0.68 non-adjacent bites along the stored solutions | Holds |
| Level 1's 8×7 face is an unreadable blob | `drawFace` on 8×7: a one-cell cyclops eye and a 3-cell mouth. On 14×14 the same seed reads | Holds |

Not re-measured: dead time per tap. Epic 4's PROGRESS gives 0.89–3.37 s, median 1.17 s.

### 1.2 Playtest 2 (Epic 4 feel)

| Claim | Measured | Verdict |
| --- | --- | --- |
| Fast taps squeeze earlier meals: 22 / 31 of 33 full meals lose their juice at 0.7 / 0.5 s per tap (level 20) | Pure timeline model: 17 / 31 / 32 of 33 at 0.7 / 0.5 / 0.35 s. My model has no 45 ms hit stops and no frame batching, and both push the scene's count up | Holds in direction; 0.5 s matches |
| 19 / 32 / 60 of 178 ticks dropped | Pure model: 0–1 bites share a frame. The drops come from actions that pile up behind hit stops and per-frame drains in the scene | Not reproduced offline; plausible |
| The combo sits at its cap for 73–94 % of finishes | 23 of 33 (70 %) on level 20 | Holds approximately |
| The pitch cap 12 and the belly cap 30 % are never reached | Largest appetite is 11 | Holds |
| Sound band, confetti, panel timing, faces | Not measured by me; I take the playtester's numbers as given | — |

---

## 2. Diagnosis, and what we keep

- **Decisions need slot pressure, and slot pressure needs necessary waits.** A muncher only costs
  a slot when it waits. In the current list the expert never needs to wait. The planned waits
  are optional, because the player can delay the waiting muncher until its colour opens.
- **The current dealer cannot make "looks-right" traps.** Eating only ever opens ground, so a
  tap that eats is almost never wrong. Traps appear only when the right muncher is buried behind
  others in its lane and the table is too small to dig to it carelessly.
- **The pictures decide how deep a level can be.**
  - One-region layers (egg, sushi rings, lollipop spirals) give levels the expert solves with one
    slot: eat the layers in order.
  - Islands (seeds, sprinkles, chips) inside several layers make colours open in pieces. That
    forces partial meals and waits, and creates real scheduling.
- **The rule is a visibility problem as much as a design one.** A player cannot use a rule they
  cannot see. The bots that set the difficulty know exposure and whether a muncher will finish,
  so the screen must show both, or the measured difficulty lies.

Keep, unchanged in principle:
- The verb and the queue rule (only fronts move).
- Reachability with tunnelling through a muncher's own colour.
- Waiting and chains, exact appetite totals, the loss rule, the +1 slot and undo boosters.
- The fixed level list; solver proof by replay.
- The pure core and generator; the timeline; Epic 4's hit stop, pools, audio manager, haptics,
  feel log and `?feelslow`.

---

## 3. Rule changes, each with its reason

**R1. Slots per level, set by measurement.**
- Rule: `slots = minSlots + slack`, where `minSlots` is the fewest slots (1–5) an exact search
  needs to win. Bounds: `2 ≤ slots ≤ 5`.
- From level 4: `minSlots ≥ 2`. Slack is 0 on normal levels and peaks, 1 on breathers. Levels
  4–10 get slack 1 on normal levels and 2 on their breather.
- Players see 3 slots in most levels, 4 in some, 2 nowhere by default (§4.5).
- Reason: slack is the only lever that moved every player model in the prototype (§4.1).
  `minSlots ≥ 2` makes at least one wait, and so a chain, part of every solution.

**R2. Eating order: one flood per patch, from its lowest reachable pixel.**
- The reachable set is unchanged: pixels of colour c connected through c to an exposed c pixel.
  Only the order changes.
- Start at the exposed pixel of colour c with the greatest row, leftmost on ties. Flood its
  whole patch breadth-first (neighbours up, left, right, down). Then start again at the lowest
  remaining exposed pixel of colour c.
- Reason: a meal reads as one stream from one place, and a partial meal leaves one bite-shaped
  hole instead of a ragged scan of the edge (playtest 1: 23–68 % scattered bites).
- "From the bottom up" is learnable after two meals.
- The prototype measured both orders: difficulty is about the same (flood slightly harder:
  skilled median 0.89 vs 0.93 at slack 0). This is a readability change, not a difficulty lever.

**R3. No outline.**
- The near-black `d` wrap goes, and `d` leaves the snack palette and the muncher bodies.
- Burying comes from the snack art: shells, rinds, crusts, plates, bowls, wrappers outside;
  seeds, sprinkles, chips, fillings inside (§4.6).
- Reason: the outline made every level open with "find the black disc", made black munchers look
  like empty rings, and added one forced layer instead of structure.

**R4. The front muncher shows what a tap would do now.** This is not a mechanic; it is the rule
made visible.
- **Ready**: reach ≥ appetite.
- **Peckish**: 0 < reach < appetite.
- **Sleepy**: reach = 0.
- Reach is counted on the snack as drawn (the shown board), so the face never runs ahead of the
  screen.
- Reason: with appetites of 10–30 nobody can count pixels. The difficulty bots know finisher vs
  partial eater, so the player must too, or the measured difficulty is wrong.
- The prototype shows this does not make levels easy: the "careful" player, who has exactly this
  information, wins only 33–41 % of zero-slack levels (median).

**R5. Idle hint on levels 1–5.**
- After `IDLE_HINT_MS` (3 s) without a tap, the front of the next move on a winning line bobs.
- On levels 1–2 a hand glyph also points at it. A glyph is not text.
- The move comes from the stored solution while the player is on it; otherwise from `solveFrom`
  with a node cap of 20,000 (no hint when the search is cut).
- Reason: three hand-made levels teach the verbs, and two more with a safety net carry the
  player into the first generated levels. From level 6 there is no automatic hint (out of scope).

**R6. Lanes are short and fully visible.**
- At most 5 munchers per lane; 1–4 lanes (1 only on level 1); 6–15 munchers per level from
  level 4.
- Reason: no "+N" on 9:16 or 16:9 (6 and 7 places per den), weightier taps, and a queue the
  player can read when planning a dig. This closes the Epic 3 open question on queue depth.

---

## 4. Generator and difficulty

### 4.1 What the prototype showed (why the playtester's levers alone are not enough)

The prototype keeps the repo's planner, adds three dealers and the exact search, and runs on nine
nested test pictures. Outputs: `out/sweep-flood*.txt`, `sweep2-*.txt`, `sweep3.txt`–`sweep6.txt`.

1. **Appetites 10–30 and 3–4 slots with today's planner and dealer are trivial.**
   - Over 1,440 levels, every competent model had a median win rate of 1.00: a one-ply smart
     player, the same with slips, careful and eater.
   - A random tapper's median was 0.77–1.00.
   - Losing taps that look right: median 0.
2. **The expert needs one slot in 60–83 % of such levels.** The planned waits are optional.
3. **Slack decides everything** (medians per setting).

   | Slack | Skilled | Eater | Random | Decisions along the solution |
   | --- | --- | --- | --- | --- |
   | 0 | 0.88–0.93 | 0.23–0.57 | 0.04–0.18 | 1–3 |
   | 1 | 0.99–1.00 | 0.59–1.00 | 0.19–0.63 | 0 |

4. **Dig-wall dealing on island-rich pictures works.** On kiwi, donut, pie and watermelon, 480
   candidates:
   - The expert needs ≥ 2 slots in 70 % of candidates and ≥ 3 in 22 %.
   - At slack 0, the normal window (§4.5) holds 29–43 % of the 2–3-slot candidates with 3 lanes
     and of the 2-slot candidates with 4 lanes.
   - The hard window holds 41 % of the 3-slot candidates (3 and 4 lanes).
   - The peak window holds 11 % of the 3-slot candidates with 3 lanes.
   - 11–14 munchers (median), longest lane ≤ 6.
   - Skilled losses come 1–2 taps after the point of no return (median; p90 3–5).
   - Cost: 88 ms per candidate with every measure.
5. **One-region pictures give almost no usable levels** (egg on a plate, sushi, ramen, lollipop,
   taco). With the same dealer, 0–3 of 40 candidates per picture land in the normal window,
   against 9–24 of 40 for kiwi, donut and pie.

### 4.2 Player models (`src/gen/players.ts`, pure, seeded)

Each turn a player looks at the fronts. For a front: its colour, its appetite, and its reach (the
number of reachable pixels of its colour on the current board).

| Player | Policy | Stands for |
| --- | --- | --- |
| `random` | Uniform among legal lanes | The floor; the old metric |
| `eater` | Uniform among fronts with reach > 0; else uniform | A player who learned the rule and does not plan (playtest 1's "edge" bot) |
| `careful` | Uniform among fronts with reach ≥ appetite; else among reach > 0; else uniform | A player who also judges finishers (what R4 shows) |
| `digger` | As careful; when no front can eat, the lane whose nearest queued muncher that could eat now is shallowest (depth ≤ `VISIBLE_DEPTH` = 5); ties uniform | Playtest 1's "smart" bot |
| `skilled(ε)` | Each turn: with chance ε act as `eater`, else as `digger`. ε = `SLIP` = 0.15 | **The main difficulty signal**: a competent first attempt with slips |
| `expert` | The exact search | `minSlots`, the stored solution, decisions |

Win rates: `PLAYER_RUNS` = 120 playouts per player while searching, `METRIC_RUNS` = 400 for the
stored metrics (standard error ≤ 0.025). Seeds: `hashSeed('level:<n>:<player>')`.

### 4.3 Metrics per level (`LevelMetrics` v2, `src/gen/level.ts`)

```ts
interface LevelMetrics {
  minSlots: number;       // fewest slots the exact search needs (1..5)
  slack: number;          // slots − minSlots
  skilledWin: number;     // skilled(SLIP), METRIC_RUNS
  diggerWin: number;
  carefulWin: number;
  eaterWin: number;
  randomWin: number;
  decisions: number;      // careful-tier traps along the stored solution (below)
  lossLagP50: number | null; // taps from the point of no return to the loss, skilled losses
  lossLagP90: number | null; //   (null when the skilled player never lost)
  chains: number;         // wake events along the stored solution
  taps: number;           // munchers
}
```

- **Decision (careful-tier trap).** A turn on the stored solution where the careful player's top
  tier holds at least one tap that keeps the level winnable and at least one tap that makes it
  unwinnable. The top tier is the finishers if any, else the eaters if any, else every legal tap.
  These are the losing moves that look right to someone who knows the rule.
- **Point of no return.** The first position of a playout that the exact search proves lost.

### 4.4 Pipeline (`src/gen/generate.ts`, `src/gen/build-levels.ts`)

1. **Plan the munchers.** Today's `planMunchers` peel, unchanged in logic, with the band's
   appetite range (§4.5) and `pWait` 0.6, `waitBudget` 4. It only provides colours and appetites
   now; the planned order no longer becomes the solution.
   - A colour with fewer than 10 pixels gets one muncher for all of them.
   - Reject a plan with any appetite below 4, or with fewer than 6 or more than 15 munchers.
2. **Deal "dig-wall".**
   - Planned index i of n gets the key `k_i = (i/n) · s_i + u_i`: `s_i = −1` with chance
     `WALL_REVERSE` 0.8, else +1; `u_i` uniform in ±`WALL_NOISE` 0.25.
   - Sort by key and deal round-robin into the lanes. Inner (late) munchers drift to the fronts,
     so digging is needed.
   - Reject lanes longer than 5.
3. **Prove and size.**
   - `minSlots(level)` = the smallest s in 1..5 for which `solveFrom` wins, with
     `EXACT_NODE_LIMIT` = 400,000 nodes per query. Node limits only, never time, so
     `levels:check` stays byte-stable.
   - Reject when unsolvable within 5 slots, when any query is cut (`unknown`), or when
     `minSlots` is below the level's minimum.
   - The stored `solution` is the search's winning path at `slots`.
4. **Set slots** = `minSlots + slack(kind, band)`, capped at 5.
5. **Measure the players**, staged so most candidates stop early:
   - the skilled win first, rejecting when more than 0.15 outside its window;
   - then eater and random;
   - then decisions and loss lag.
6. **Select.**
   - The first candidate inside all of its band's windows wins.
   - Else the closest by distance: the summed overshoot of the three win rates, plus 0.1 per
     missing decision, plus 0.1 per tap of p90 loss lag over the bound.
   - A level with no hit in `CANDIDATES` = 160 seeds gets a second round of 160 seeds
     (`level:<n>:x<k>`) with the same parameters. More lanes lower the yield of 3-slot levels.
   - The build fails when more than 5 of levels 4–100 miss, or any peak misses.
7. **Validate** (GENERATOR §1 invariants), then store the metrics at `METRIC_RUNS`.

### 4.5 Bands and numeric targets

All win rates are per level. "Slots" is what the player sees.

| Levels | Kind | Lanes | Appetite | minSlots | Slots | Skilled | Eater | Random | Decisions | Loss lag p90 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1–3 | Onboarding (hand-made, §5) | 1 / 2 / 3 | fixed | 2 | 3 | 1.00 / ≥ 0.99 / ≥ 0.95 | 1.00 / 1.00 / 0.50–0.70 | — | 0 / 0 / — | — |
| 4–10 | Learn to park | 2–3 | 10–24 | 2 | 3 (slack 1) | ≥ 0.95 | 0.60–0.95 | ≤ 0.70 | — | ≤ 4 |
| 11–30 | Normal | 3 | 10–30 | 3 | 3 (slack 0) | 0.85–0.95 | ≤ 0.65 | ≤ 0.35 | ≥ 1 | ≤ 4 |
| 31–60 | Normal | 3 | 10–30 | 3 | 3 (slack 0) | 0.82–0.94 | ≤ 0.55 | ≤ 0.30 | ≥ 1 | ≤ 4 |
| 61–100 | Hard | 3–4 | 12–30 | 3–4 | 3–4 (slack 0) | 0.80–0.92 | ≤ 0.50 | ≤ 0.25 | ≥ 2 | ≤ 4 |
| Breathers (5, 15, 25 … 95) | Easier | band's | band's | band's minimum − 1, at least 2 | +1 slack (levels 4–10: +2) | ≥ 0.95 | ≥ 0.60 | — | — | — |
| Peaks (20, 30 … 100) | Hardest | 3 | band's | ≥ 3 | slack 0 | 0.50–0.70 | ≤ 0.30 | ≤ 0.10 | ≥ 2 | ≤ 4 |

How the targets were checked against the prototype yields (island-rich pictures, slack 0, share
of all candidates):

| Window | Lanes, minSlots | Yield |
| --- | --- | --- |
| Normal | 3 lanes, minSlots 3 | 8 % (20 of 240) |
| Hard | 3 lanes, minSlots 3–4 | 13 % (32 of 240) |
| Hard | 4 lanes, minSlots 3 | 4 % (9 of 240) |
| Peak | 3 lanes, minSlots ≥ 3 | 4 % (9 of 240) |

At 160 + 160 seeds per level, that is about 12 expected peak hits, so a peak should essentially
never miss on pictures this rich. Four lanes stay in the hard band only, where the yield allows
them. On the real snacks, B5 measures the yields again.

Curves (tests):
- The band means of `skilledWin` and of `eaterWin` do not rise from band to band (sawtooth
  excluded).
- Every normal and peak level has `chains ≥ 1`.

Calibration rule: task B5 runs the real snack set. When a window's hit rate falls below 3 %, the
coder widens that window by 0.03 per bound (at most twice) and records it in docs/questions.md.
Moving a target any further needs the main session's sign-off.

### 4.6 Snack requirements (content; pure lint over `src/data/snacks.ts`)

From level 4, every snack as played must meet all of these. The metrics live in
`src/gen/snack-metrics.ts`.

**Size and colours**
- 12×12 to 16×16 cells (levels 4–30) or 12×12 to 18×18 (31–100).
- 110–230 pixels.
- 4–6 palette colours; every colour has at least 4 pixels.
- No near-black.
- Blue with purple, and brown with maroon, never share a snack. These are the pairs dichromats
  lose (Epic 4 gate).

**Burying**
- Buried share at the start ≥ 55 %.
- At least 8 islands (a patch of one colour with no side on open ground at the start), over at
  least 3 colours.
- Peel depth ≥ 3: rounds of "every colour eats all it can reach" until nothing is left.

The thresholds come from the prototype:

| Picture | Buried | Islands | Island colours | Result |
| --- | --- | --- | --- | --- |
| Kiwi | 76 % | 10 | 3 | Rich |
| Donut | 68 % | 14 | 5 | Rich |
| Pie | 60 % | 11 | 3 | Rich |
| Egg on a plate | 54 % | 2 | 2 | Trivial |
| Ramen | 28 % | 4 | 3 | Trivial |
| Sushi | 53 % | 5 | 2 | Trivial |

Without the outline, today's snacks measure 77–100 % reachable at the start, except lollipop,
watermelon, sushi, donut and taco. So almost the whole set is redrawn.

Count and kinds:
- 3 onboarding snacks (§5).
- **22 snacks** for levels 4–100 (cycled, mirrored on alternate passes as today).
- Food with natural nesting and islands:
  - kiwi, berry pie, donut with sprinkles, watermelon with seeds;
  - pizza (crust, sauce, cheese, toppings), fruit tart, cupcake in a wrapper with sprinkles;
  - choc-chip cookie on a plate, strawberry dipped in chocolate, pomegranate, fig, dragon fruit
    (maroon seeds, not black);
  - sushi roll with sesame and fillings, bento box, candy jar, ice-cream bowl with toppings;
  - burger with a sesame bun, taco with fillings, onigiri, mooncake, macaron box, fried egg on a
    plate with pepper flakes.
- Containers (plate, bowl, wrapper, box, jar) are welcome: the munchers eat the plate too, which
  is a running joke for the Face pillar.

Art quality is the Face pillar. A contact sheet of the 22 snacks at 128 px goes through the
playtester and `design:design-critique` before the generator is calibrated on them.

### 4.7 Build budget and determinism

- `npm run levels` ≤ 5 min on CI. Estimate:
  - Normal levels need ~15 candidates at ≈ 90 ms each.
  - Peaks need ~60.
  - Stored metrics take ≈ 0.6 s per level.
- Everything goes through `Rng` and node budgets. `levels:check` stays byte-for-byte.

---

## 5. Onboarding: levels 1–3 (hand-designed, verified on the prototype rules)

Data goes to `src/data/onboarding.ts` and is played as levels 1–3. `validateLevel` accepts them
with their kind `onboarding`. Every number below comes from `proto/tutorial.ts` (output:
`out/tutorial.txt`): every tap order enumerated, the players at 400 runs each, flood order. The
peel order gives the same win and loss counts.

### Level 1: "Egg" (12×12, 1 lane, 3 slots), about 8 s: the rule, a chain, the payoff

```
....wwww....
..wwwwwwww..
.wwwyyyywww.
.wwyyyyyyww.
wwyyyyyyyyww
wwyyyyyyyyww
wwyyyyyyyyww
wwyyyyyyyyww
.wwyyyyyyww.
.wwwyyyywww.
..wwwwwwww..
....wwww....
```

- Lane 0: `y52, w60`. White 60, yolk 52.
- Tap 1: the yolk muncher hops, sits sleepy, looks up at the dim yolk, and waits (amber slot).
- Tap 2: the white muncher eats the whole ring in one stream from the bottom; the yolk lights up
  as it is exposed; the yolk muncher wakes and eats 52; the face lights up.
- Verified: one legal order; it wins with a chain wake. `minSlots` 2. The hand glyph points at
  each front in turn.

### Level 2: "Donut" (13×13, 2 lanes, 3 slots), about 12 s: choice, the threat, parking pays

```
....sssss....
..sssssssss..
.sskkkkkkkss.
.skkykkkkyks.
sskkkkkkkkkss
skkkkk.kkkkks
skykk...kkyks
skkkkk.kkkkks
sskkkkkkkkkss
.skykkkkykks.
.sskkkkkkkss.
..sssssssss..
....sssss....
```

- Lane 0: `y6, k36, k36`. Lane 1: `s54`. Dough 54, icing 72, sprinkles 6.
- At the start the dough muncher is ready and lane 0's front is sleepy.
- Verified: of the 4 tap orders, 3 win and every win has a chain.
  - The stored solution is `0 0 1 0`: park the sprinkle and the icing munchers, then the dough
    muncher's tap wakes both, a double chain.
  - The only losing order taps lane 0 three times: three sleepy munchers fill the table while the
    ready one waits in its den.
- Players: skilled 1.00, eater 1.00, random 0.88. `minSlots` 2. The hint (3 s idle) bobs the
  stored solution's next front.

### Level 3: "Kiwi" (14×14, 3 lanes, 3 slots), about 15 s: the first dig

```
.....nnnn.....
...nnllllnn...
..nllllllllnn.
.nllmllllmlln.
.nllllwwllllln
nllllwwwwlllln
nlmlwwwwwwlmln
nlllwwwwwwllln
nllllwwwwlllln
.nllllwwllllln
.nllmllllmlln.
..nllllllllnn.
...nnllllnn...
.....nnnn.....
```

- Lanes: `m6, n38` | `l30, w24` | `l54`. Skin 38, flesh 84, seeds 6, core 24.
- All three fronts are sleepy at the start. The brown skin muncher stands right behind the seed
  muncher.
- Verified: of 21 tap orders, 9 win (all with chains) and 12 lose. The cause is always visible:
  a table full of sleepy munchers while the skin muncher waits behind the seeds.
- Players: skilled 0.98, digger 1.00, careful 0.63, eater 0.60, random 0.34. `minSlots` 2.
- Stored solution `0 0 1 1 2`: dig the seeds, eat the skin, then the flesh with the seeds waking
  twice.

### The first 30 seconds (estimate with §8's timings)

- Level 1 is done at about 8 s: two taps, a chain, a 112-bite cascade, and the face lights up
  with the panel 1.2 s later.
- Level 2 is done at about 20 s: one choice, the threat, a double chain.
- By about 25 s the player faces level 3's dig.

Total in the first 30 s: at least 2 chains (3 wakes on the hinted path), 2 reveals, and the first
real decision. The graybox gave 0 chains and 0 decisions.

---

## 6. Picture-size minimums

- Every level: both sides ≥ 12 cells, both ≤ 18.
- Levels 1–10: sides ≤ 14, so cells are ≥ 64 design px on 9:16 (snack square 896).
- Levels 11–100: sides ≤ 18, so cells are ≥ 49 design px.
- The face must read on every level's grid. `face.ts` scales its features with the grid, and the
  test "every level's face reads" checks, on each level's own grid:
  - each eye is ≥ 2×2 cells, or one cyclops eye ≥ 3×3;
  - ≥ 1 cell between the eyes;
  - a mouth ≥ 3 cells wide;
  - ≥ 1 cell between the eye row and the mouth.

---

## 7. Visibility fixes

**V1. Exposed vs buried pixels (`cellLook`, pure; 8 canvas px per cell as today).**
- Exposed: the raised tile, with its fill in the palette colour, top-left edge mixed 0.35 towards
  white and bottom-right edge mixed 0.35 towards black.
- Buried: flat, with the same fill in the 4×4 centre and a 2-px recessed border mixed 0.45
  towards `COLOR_HOLE`. No highlight.
- Colour identity is kept: the centre pixel is the palette colour in both looks, so no colour is
  produced by tint.
- A pixel that becomes exposed on screen glints: drawn mixed 0.45 towards white for
  `EXPOSE_GLINT_MS` (120 ms), then raised. No sound.
- Exposure is computed on the **shown** board: the cells eaten on screen, via `openGround`.

**V2. Front moods** (R4). These replace Epic 4's `idle` overlay.
- `ready`: eyes wide on the snack, mouth open, a small hop every `READY_BOUNCE_MS` (1500).
- `peckish`: eyes on the snack, a small "o" mouth, no hop.
- `sleepy`: half lids, mouth shut, slow breathing (2 s).
- Queued munchers keep the `queue` overlay.

**V3. Holes and the face.**
- Eaten cells are `COLOR_HOLE` (≈ 0x141824, L\* 8) with the face drawn as a silhouette:
  `peek(c) = mix(c, COLOR_HOLE, PEEK_MIX = 0.85)`.
- At 0.85 the lightest face colour (the eye white) lands at L\* 22.1. At 0.8 it would land at
  26.5, over the bound below. The darkest snack colour, maroon, is L\* 34.0; the board is 36.0.
- Transparent snack cells stay the board colour until the win, so a bitten hole reads darker
  than empty board.
- At the win the face lights up into the vivid **reveal** palette, sweeping out from the last
  bite over `REVEAL_SWEEP_MS` (500).
- Tests:
  - L\*(peek colours) ≤ 25 < 33 ≤ L\*(every snack colour).
  - L\*(hole) < L\*(board).
  - Reveal colours: chroma ≥ 40, 35 ≤ L\* ≤ 75. Vivid without nursery pastels: the 13+ rule.
- The ΔE ≥ 18 rule against snack colours now applies to the peek family only. The reveal shows
  when no pixel is left.

**V4. No outline** (R3). Remove `outline()` from the build, `OUTLINE_KEY`, the `d` muncher body
and the "outline only exposed colour" tests.

**V5. Queues fully visible** (R6). Test: no level starts with a "+N" chip on 9:16 or 16:9. On
1:1, at most one "+1" per den.

**V6. A tap on a snack pixel** makes every front muncher of that colour bob once. No sound, no
action. Playtest 1: "the snack (40 % of the screen) ignores taps". It teaches that the munchers
do the eating.

---

## 8. Feel fixes on top of Epic 4 (playtest 2), and D4 revisited

### 8.1 D4 is replaced by D4′: parallel meals, causal order, no squeeze

D4 as built: a new tap squeezes all pending playback into 150 ms and strips its hit stop, kick
and haptic. At 0.5 s per tap, 31 of 33 full meals lose their juice. That inverts the Feel pillar:
the juice only pays the player for waiting.

**D4′.**
1. **Per-slot tracks.** Each seated muncher's meal plays on its own track at its own interval.
   A new tap never moves another muncher's actions.
2. **Causal order from the rules.**
   - Every `bite` event gets an `id` (a running counter of the game; undo restores it) and a
     `dep`: the id of the bite after which this cell became reachable to its colour, or −1 when
     it was reachable at the level start.
   - `Game` keeps `reachSince: Int32Array`, updated after each bite. This runs only when
     constructed with `{ deps: true }`, as the player's game is; the solver and playouts skip
     it, as they skip `history`.
   - The timeline starts a bite at `max(track cursor, landing of dep + DEP_GAP_MS 30)`.
   - A wake plays `WAKE_MS` before the woken muncher's first bite.
   - A full or wait plays when the muncher's last bite of the batch lands.
   - Won plays after the last landing + `WIN_BEAT_MS`; lost after the last landing + the stuck
     beat.
3. **Hurry, never skip.**
   - When a new muncher takes a slot whose previous occupant is still eating on screen, only
     that occupant's remaining bites are rescheduled into `HURRY_MS` (300), keeping order and
     deps.
   - It keeps its finish: hit stop, kick, burp, puff and haptic, subject to the merge rules.
   - The new muncher's hop lands after the old one leaves.
4. **Merge rules.**
   - Hit stops never stack: a new stop is skipped within `HIT_STOP_GAP_MS` (150) of the last one.
   - A kick during a kick restarts at the larger intensity.
   - Haptics at least `HAPTIC_GAP_MS` (40) apart; later ones merge.
   - At most one sound of a kind per frame; merged bite ticks play the highest pitch.
5. **Flush** (retry, undo, leaving the scene) still plays everything at once, as today.

### 8.2 The other findings

| # | Finding (playtest 2) | Change | Constants (`src/game/feel.ts` unless named) |
| --- | --- | --- | --- |
| F1 | KRİTİK: fast taps strip the juice | D4′ above | `DEP_GAP_MS` 30, `HURRY_MS` 300, `HIT_STOP_GAP_MS` 150, `HAPTIC_GAP_MS` 40; `FAST_FORWARD_MS` only for flush |
| F2 | YÜKSEK: dropped ticks | Tracks remove the packing. Tick thinning: within a track, ticks stay ≥ `TICK_MIN_GAP_MS` 55 apart; the last bite always ticks at +2 dB | `TICK_MIN_GAP_MS` 55 |
| F3 | YÜKSEK: phone speakers lose success | See the sound list below | `GAIN.ding`; new `SFX_PHONE_DB` table |
| F4 | ORTA: flat repetition | The combo drops one step after `COMBO_DECAY_MS` (1200) without a finish; a wait still resets it. `ComboCounter` takes the scene time | `COMBO_DECAY_MS` 1200 |
| F5 | ORTA: the hop has no anticipation | Crouch first (1.15 / 0.85 for `HOP_CROUCH_MS` 70), then the arc (`HOP_MS` 200), then the landing squash (80). The timeline's landing = tap + 270 ms | `HOP_CROUCH_MS` 70, `HOP_MS` 200 |
| F6 | ORTA: flights pop | `BITE_FLIGHT_MS` 300 on an ease-out (quad-out) arc. Pure `flightAt(t)`; no 60 fps frame moves more than 0.2 of the path; the last 3 frames move less than 0.1 together. Pools sized from the worst case (flights ≥ 32, crumbs ≥ 72; 2 crumbs per bite when the interval is under 50 ms) | `BITE_FLIGHT_MS` 300, `BITE_EASE`, pool sizes |
| F7 | YÜKSEK: a dull win reveal | See the win list below | `WIN_PANEL_DELAY_MS` 1200, `REVEAL_SWEEP_MS` 500, `CONFETTI_COUNT` 70, `CONFETTI_PX_MIN` 40, `CONFETTI_PX_MAX` 60 |
| F8 | ORTA: munchers read mean | Blissful full face: closed "^ ^" eyes, a wide smile, brows relaxed. Ready face: eager, brows up. Burp puff 4 clouds at 0.4 of the muncher (was 3 at 0.16). Not baby-faced: eyes high, the fang stays | `PUFF_COUNT` 4, `PUFF_SIZE_SHARE` 0.4 |
| F9 | Pitch and belly caps never reached | Pitch and belly scale with the share of the meal eaten (see below) | `MEAL_TARGET_MS` 1400, `BITE_INTERVAL_MIN_MS` 30, `BITE_INTERVAL_MAX_MS` 70, `MEAL_PITCH_STEPS` 10 |
| F10 | FLOW: a text-only Title, then three levels without a choice | Title: an idling muncher (mood `ready`) next to the play button, pulled forward from Epic 6 task 3 at its minimum. Onboarding §5 | — |

**F3 sound changes.**
- `burp`: fundamental ≥ 300 Hz, ≥ 50 % of its energy above 400 Hz.
- A new `ding`: a bright bell at 1.2–2 kHz, layered on every full meal.
- `win`: +6 dB in the band above 400 Hz.
- The bite tick is tuned to C (`BITE_BASE_HZ` = 1046.5), and its steps follow the C major
  pentatonic, so every rise sits in the 16 s loop's key (today's steps run 39 cents sharp of A).

**F7 win changes.**
- The panel and its dim wait `WIN_PANEL_DELAY_MS` (1200 ms) after the last bite. The face gets
  its moment first.
- The reveal sweep turns the silhouette vivid (V3).
- 70 confetti pieces of 40–60 px burst radially from the face's centre, with no launch line.
- The level number on the face card stays at full brightness.
- The early snacks are ≥ 12×12 (§6).

**F9 meal scaling.**
- Bite interval = clamp(`MEAL_TARGET_MS` / appetite, 30, 70) ms, so a meal of 10–60 bites takes
  0.7–1.8 s.
- Pitch: bite n of a meal of a rises `floor(MEAL_PITCH_STEPS · (n−1)/(a−1))` pentatonic steps,
  two octaves over the whole meal. The combo lifts the base one step per combo step.
- Belly = 1 + 0.3 · n / a, so every meal ends at the top.
- D1 and D2 are superseded; D3 stays.

D5's cascade target becomes **1–2.5 s per tap that ends in a full meal**. Chains extend it.
`tests/cadence.test.ts` is re-baselined on the new levels.

---

## 9. Acceptance tests

Pure tests over all levels wherever possible. Names are `file › test`.

### 9.1 Rules and the search

| Target | Test |
| --- | --- |
| R2 order, same reachable set | `tests/core.test.ts` › "flood order: the worked examples of GENERATOR §2" + `tests/core-props.test.ts` › "flood and peel reach the same set; inside a patch every bite after the first is next to an earlier one" (2,000 random boards) |
| R1 slots | `tests/solve.test.ts` › "minSlots on hand-made levels (level 1 needs 2; the ring needs 1)" + "minSlots agrees with brute force on 300 small random levels" |
| D4′ deps | `tests/core.test.ts` › "a chain's first bite depends on the bite that opened it; meals reachable at the tap have earlier deps; undo restores the bite counter" |
| Player models | `tests/players.test.ts` › "each player picks as specified on hand-made positions" + "skilled slips at rate SLIP ± 0.02 over 10,000 turns" |
| Decisions | `tests/solve.test.ts` › "careful-tier traps: the hand-made trap level has exactly one; a slack-1 level has none" |

### 9.2 Content and onboarding

| Target | Test |
| --- | --- |
| Onboarding levels | `tests/onboarding.test.ts` › "level 1: one order, it wins with a wake" · "level 2: 3 of 4 orders win, all with a wake, the stored one with a double wake; the loss is lane 0 ×3" · "level 3: all fronts sleepy at the start; 9 of 21 orders win; skilled ≥ 0.95, eater 0.50–0.70" |
| Snack lint | `tests/content.test.ts` › "every snack of levels 4–100 meets the §4.6 metrics" · "no near-black colour" · "no dichromat pair shares a snack" · "onboarding snacks are 12–14 per side" |
| Picture sizes and the face | `tests/levels.test.ts` › "every grid is 12–18 per side; levels 1–10 at most 14" + `tests/face.test.ts` › "every level's face reads (§6)" |

### 9.3 The level list (pure, over `src/data/levels.json`)

| Target | Test |
| --- | --- |
| All levels proven | `tests/levels.test.ts` › "every level validates and its solution replays to a win within its slots" |
| Slots by measurement | levels.test › "from level 4: minSlots ≥ 2; slots = minSlots + slack(kind); 2 ≤ slots ≤ 5" + a slow test that re-derives `minSlots` for 10 sampled levels |
| Windows | levels.test › "every level 4–100 is inside its kind's windows (§4.5) or listed in the ≤ 5 recorded misses; no peak misses" (stored metrics) |
| Decisions and loss lag | levels.test › "normal ≥ 1 and hard/peak ≥ 2 decisions; skilled loss lag p50 ≤ 2 and p90 ≤ 4" |
| Taps are not crumbs | levels.test › "levels 4–100: 6–15 munchers; appetites 10–30 except a whole colour under 10; none under 4" + "the mean appetite of levels 11–100 is ≥ 14" |
| Curves | levels.test › "band means of skilledWin and eaterWin do not rise band to band; every normal and peak level has ≥ 1 chain" |
| Queues visible | `tests/layout.test.ts` › "no level starts with a +N on 9:16 or 16:9; at most +1 per den on 1:1" |
| Determinism | `tests/gen.test.ts` › "same seed, same level; 200 seeds per band give valid, proven candidates; the hit rate per band window is ≥ 3 %" + `npm run levels:check` |

### 9.4 Visibility

| Target | Test |
| --- | --- |
| Cell looks | `tests/look.test.ts` › "both looks keep the palette colour at the centre; exposed has the bevel; buried the recessed border and no highlight" |
| Holes and the face | look.test › "peek L\* ≤ 25 < 33 ≤ every snack colour; hole darker than the board; reveal colours vivid (chroma ≥ 40, L\* 35–75)" |
| Moods | look.test › "frontMood: ready / peckish / sleepy from reach and appetite" + `tests/textures.test.ts` › "three distinct front overlays and a blissful full overlay" |
| Hints | `tests/e2e/onboarding.spec.ts` › "level 1 by real taps: the yolk waits, wakes after the white, the face lights up" · "3 s idle on level 3 bobs the stored solution's front" · "no hint on level 6" |

### 9.5 Feel (D4′ and F1–F10)

| Target | Test |
| --- | --- |
| No squeeze | `tests/timeline.test.ts` › "a second tap never moves another muncher's actions" |
| Causal order | timeline.test › "no bite starts before its dep lands" (property: 200 levels × random paces 0.2–1.5 s) |
| Parallel meals | timeline.test › "meals reachable at the tap overlap in time" |
| Chains start early | timeline.test › "a chain starts DEP_GAP after the unlocking bite, not after the whole meal" |
| Hurry | timeline.test › "a taken slot hurries only its occupant, inside HURRY_MS, keeping its full" |
| Merges | timeline.test › "hit stops merge within HIT_STOP_GAP" |
| Fast taps keep the juice | `tests/e2e/feel.spec.ts` › "taps every 0.5 s: ≥ 90 % of full meals log a hit stop (or one merged within 150 ms) and a kick; ≤ 5 % of bite ticks merged" |
| Screen equals rules | `tests/e2e/game.spec.ts` › "rapid taps: the settled screen equals the rules" (kept) |
| F3 phone band | `tests/audio.test.ts` › "phone band (400 Hz high-pass): full meal (burp + ding + last tick) ≥ tick + 6 dB; win ≥ tick + 9 dB; nope, wait, stuck ≤ tick" · "burp: ≥ 50 % of its energy above 400 Hz". Uses ffmpeg `highpass=f=400,volumedetect` like `SFX_FILE_DB`, skipped without ffmpeg |
| F3 tuning | `tests/feel.test.ts` › "bite pitches lie on the C major pentatonic within ±5 cents" |
| F4 | feel.test › "the combo decays one step per COMBO_DECAY_MS without a finish; a wait resets it" |
| F5 | feel.test › "hop: crouch, then arc, then landing" + timeline.test › "first bite ≥ tap + HOP_CROUCH_MS + HOP_MS" |
| F6 | feel.test › "flight: no 60 fps frame moves more than 0.2 of the path; soft arrival" + feel.spec › "pools: a long level ends with the object count of its first tap" (kept) |
| F7 | feel.spec › "the win: the panel opens ≥ 1.2 s after the last bite; ≥ 60 confetti pieces of ≥ 40 px; the reveal palette is on; the level number is not dimmed" |
| F8 | textures.test (above) + the design gate on screenshots |
| F9 | feel.test › "every meal's last bite is at the top pitch step and belly 1.3; intervals 30–70 ms" |
| D5 | `tests/cadence.test.ts` › "taps that end in a full meal run 1–2.5 s (median inside, ≥ 95 % inside)" |
| First 30 seconds | `tests/e2e/onboarding.spec.ts` › "a scripted new player (the hint's taps) reaches level 3 within 30 s with ≥ 3 wakes logged" |

---

## 10. Proposed GDD.md edits (exact text)

Replace §2 with:

> ## 2. Core loop
>
> 1. The level shows a **snack**: a pixel picture of 12×12 to 18×18 cells in 4–6 colours (fewer
>    on the first three levels). Its colours are nested: a shell, rind, crust, plate or wrapper
>    outside; seeds, sprinkles, chips or a filling inside.
> 2. Below the snack sits the **table**, a row of waiting slots: 3 in most levels, 4 in some
>    (each level has its own number). Below that are the **dens**: 1–4 lanes, each a short queue
>    of at most 5 munchers, all visible. Each muncher has a colour and an **appetite**: 10–30
>    pixels, or all of its colour when the colour has fewer than 10.
> 3. Only the front muncher of a lane can be tapped. Its face says what a tap would do now:
>    **ready** (it can eat its whole appetite), **peckish** (it can eat some, then it will wait)
>    or **sleepy** (nothing of its colour can be reached yet).
> 4. The player taps a front muncher. It hops into the leftmost free slot.
> 5. A muncher in a slot eats the pixels of its colour it can **reach** (§3): from the lowest one,
>    one patch at a time, until its appetite is used up. Each bite, a pixel lifts off the snack
>    and flies into its mouth.
> 6. A full muncher burps and leaves; its slot is free again.
> 7. A muncher that cannot reach enough **waits** in its slot, mouth open. When other munchers
>    uncover pixels of its colour, it wakes up and eats on its own (a **chain**). Most levels
>    need one or two munchers to wait at the right moment: the table is the puzzle.
> 8. **Win**: the snack is gone. The face under it lights up, and the level ends.
> 9. **Lose**: every slot holds a waiting muncher that cannot reach anything, and the dens are
>    not empty. Retry, or take **+1 slot** (rewarded) and play on.
>
> No timer, no hearts, no stars. A level is the same for every player, and every level is proven
> winnable without boosters (GENERATOR.md §4).

In §3 Rules, replace the "Eating order" bullet with:

> - **Eating order**: a muncher starts at the lowest pixel of its colour it can reach (leftmost on
>   ties) and eats outward through its colour, breadth-first, before it starts again at the
>   lowest reachable pixel of another patch of its colour. Every meal is one stream from one
>   place, and a partial meal leaves one bite-shaped hole.

In §3, add after "Only the front muncher of a lane moves.":

> - **Slots**: each level has its own number of slots, 2–5 (3–4 in most levels). It is the fewest
>   slots an exact search needs to win the level, plus the level's slack: 0 on most levels, 1 on
>   breathers (2 on the breather of levels 4–10). So most levels need every slot at the right
>   moment, and a loss always comes from munchers that sat down too early.
> - **The front muncher's face** shows what a tap would do now (ready, peckish, sleepy), counted
>   on the snack as drawn. It is the rule made visible, not a rule.

In §3a, replace these rows:

> | Tap a front muncher, a slot is free | crouch 1.15/0.85 for 70 ms, hop on an arc into the slot in 200 ms, land squash 80 ms | `hop`, pitch by colour index | none | 10 ms |
> | …each bite | the pixel lifts, shrinks and flies into the mouth on an ease-out arc in 300 ms; crumbs where it stood; the belly swells to +30 % at the meal's last bite; the counter drops on arrival; bites every 1400 ms / appetite (30–70 ms) | `bite` tick on the C major pentatonic, rising two octaves over the meal; ticks at least 55 ms apart | none | none |
> | …the last bite (full) | hit stop 45 ms, belly bounce 1.2×, blissful face (eyes closed in "^ ^", wide smile), a burp puff of 4 clouds at 0.4 of the muncher, then waddle off in 300 ms | `bite` at +2 dB, then `burp` (≥ 300 Hz) with a `ding` | kick 70 ms, 0.002 × (1 + 0.25 × combo step) | 12 ms |
> | Last pixel (win) | its own beat: the bite lands, 250 ms later hit stop 60 ms; the face lights up from the dark silhouette into its full colours in a 500 ms sweep from the last bite, blinks and grows 1.08×; 70 confetti pieces of 40–60 px burst from the face; the panel opens 1.2 s after the last bite, the level number bright | `win` jingle, +6 dB above 400 Hz | kick 120 ms, 0.0045 | 20-40-40 ms |

In §3a, replace the bullets "Combo step", "Cascade per input" and "Input stays open" with:

> - **Combo step** = finishes in a row without a muncher sitting down to wait. The first finish
>   is step 0, the cap 3, and it drops one step after 1.2 s without a finish. It raises the
>   full-meal kick and the base pitch of the bites (one pentatonic step per combo step).
> - **Cascade per input**: one tap releases 1–2.5 s of motion the player does not drive (hop,
>   meal, finish); chains extend it.
> - **Meals play in parallel.** Every seated muncher eats on its own track. A new tap never
>   shortens another muncher's meal, so every finish keeps its hit stop, kick and burp however
>   fast the player taps. A bite never leaves before the bite that uncovered it (the rules give
>   each bite its dependency). Only the muncher still eating in the slot a new muncher takes is
>   hurried, finishing within 300 ms with its finish intact.
> - **Juice merges, it never stacks**: hit stops at least 150 ms apart, one kick at a time (the
>   stronger wins), haptics at least 40 ms apart, one sound of a kind per frame.

Replace §4 "Munchers" and "What is left to eat always reads" with:

> - **Munchers**: round blobs, one per colour, with big eyes and a big mouth, hungry rather than
>   mean.
>   - At the front: **ready** (eyes wide on the snack, mouth open, a small hop every 1.5 s),
>     **peckish** (eyes on the snack, a small "o" mouth) or **sleepy** (half lids, mouth shut).
>   - Waiting: mouth open, eyes up. Full: blissful, eyes closed in "^ ^", a wide smile.
>     Stuck: eyes down.
>   - Not baby-faced: eyes sit high, brows are drawn, a fang.
>   - Drawn procedurally at boot, one texture per colour, no runtime tint.
> - **What is left to eat always reads.**
>   - Pixels a muncher can reach now are raised tiles (light top edge, dark bottom edge).
>   - Pixels still buried are flat and recessed (a dark inner border), in the same colour.
>   - A pixel that becomes reachable glints once.
>   - Eaten cells are dark holes with the face only as a dark silhouette.
>   - Transparent cells keep the board colour until the win.
>   - At the win the face lights up in its full colours.

Replace §6 "Fair" bullets 1–2 with:

> - Every level is proven winnable without boosters by an exact search, which also stores its
>   solution (GENERATOR.md §4).
> - Difficulty is measured on player models, not a random tapper:
>   - a skilled player (prefers finishers, digs to the nearest eater, slips 15 % of the time);
>   - an eater (taps anything that can eat);
>   - a random tapper.
>
>   A skilled player wins 85–95 % of normal levels, 50–70 % of peaks and ≥ 95 % of breathers.
>   An eater wins at most 65 % from level 11, a random tapper at most 35 % (GENERATOR.md §5–6).
> - Every normal level holds at least one decision that looks right and loses, and a loss comes
>   within 2 taps of the mistake (median), so its cause is still on screen.

In §8, add at the start:

> Levels 1–3 are hand-made onboarding:
> - Level 1, egg: the rule, a chain and the face in two taps.
> - Level 2, donut: a choice, the full-table threat, a double chain.
> - Level 3, kiwi: the first dig.
>
> Levels 1–5 show an idle hint after 3 s (the next move of a winning line bobs; a hand on
> levels 1–2). Levels 4–100 are generated (GENERATOR.md §6).

In §9, replace items 2 and 4:

> 2. **Title**: logo, a big play button with the level number, sound and music toggles, a ready
>    muncher idling next to the button.
> 4. **Win**: the face lights up and gets its moment; 1.2 s after the last bite the panel opens
>    with the face big and the level number bright. Tap anywhere → next level (or the
>    interstitial when the gate allows).

In §13, replace "hidden queues as a mechanic (…)" with:

> hidden queues (all queues are fully visible; lanes hold at most 5), hints beyond the idle hint
> of levels 1–5.

---

## 11. Proposed GENERATOR.md edits (exact text)

§1 "Picture": replace the first bullet with:

> - Size 12×12 to 18×18 (levels 1–10: at most 14 per side). Levels 1–3 use 2–4 colours; from
>   level 4, 4–6 colours, each with at least 4 pixels, and the structure metrics of §6.4. No
>   outline, no near-black colour.

§1 "Level": replace the interface and invariants with:

> ```ts
> interface Muncher { c: string; a: number }
> type LevelKind = 'onboarding' | 'normal' | 'breather' | 'peak';
> interface Level {
>   id: number; snack: string; rows: string[];
>   lanes: Muncher[][];      // lanes[i][0] is the front; at most 5 per lane
>   slots: number;           // 2..5 = metrics.minSlots + slack(kind, band)
>   kind: LevelKind;
>   face: number;
>   solution: number[];      // the exact search's winning path at `slots`
>   metrics: LevelMetrics;   // §5
> }
> ```
>
> Invariants (`validateLevel`, tests and the build):
> 1. Every pixel colour has munchers, and the appetites of a colour add up to its pixel count.
> 2. Every muncher's colour appears in the picture. Appetites are integers ≥ 4. From level 4 they
>    are 10–30, except a muncher carrying the whole of a colour with fewer than 10 pixels.
> 3. `solution` replays through the real rules to a win within `slots`, without boosters.
> 4. 1 ≤ lanes ≤ 4 (1 only on level 1), every lane holds 1–5 munchers, and 2 ≤ slots ≤ 5. From
>    level 4: 6–15 munchers, `metrics.minSlots ≥ 2`, `slots = minSlots + slack`.

§2: replace the "Reachable(c)" bullet with:

> - **Reachable(c)**: the PIXEL(c) cells connected through PIXEL(c) cells to an exposed PIXEL(c)
>   cell. **Eating order**: take the exposed PIXEL(c) cell with the greatest row (smallest column
>   on ties) and flood its patch breadth-first (neighbours up, left, right, down); repeat from the
>   next such cell not yet listed.

§2: add to the event list:

> - every `bite` carries `id` (a running count of the game's bites; undo restores it) and `dep`:
>   the id of the bite after which its cell became reachable to its colour, or −1 if it was
>   reachable at the level start. Computed only for the player's game (`{ deps: true }`).
>   The scene plays a bite no earlier than its dependency's landing.

§2: replace worked examples 3 and 4 with these (cells as (x, y)):

> 3. Hole: `rrrr / r.gr / rrrr`, lanes `[[g1], [r3, r7]]`.
>    - g waits.
>    - r3 starts at the lowest exposed red, (0,2), and eats (0,2), (0,1), (1,2). Eating (0,1)
>      opens the hole at (1,1) to the outside, so g at (2,1) is exposed and wakes on the same
>      resolve.
>    - r7 eats (2,2), (3,2), (3,1), (3,0), (2,0), (1,0), (0,0) → won. Two slots are enough;
>      one is enough when r3 goes first.
> 4. Appetite larger than reach: `rrr / rgr / rrr`, lanes `[[r3], [g1], [r5]]`.
>    - r3 eats (0,2), (0,1), (1,2).
>    - g is exposed through (0,1) and eats on the next tap.
>    - r5 eats (2,2), (2,1), (2,0), (1,0), (0,0).

In example 1, replace the ring's eating order with "(0,2), (0,1), (1,2), (0,0), (2,2), (1,0),
(2,1), (2,0)".

Add example 5:

> 5. `minSlots`: level 1 (the egg) needs 2 slots. Its only order seats the yolk muncher, which
>    waits, before the white muncher. With 1 slot the first tap loses.

§3: replace the whole section with:

> ## 3. Generator (`src/gen/generate.ts`)
>
> Input: a picture, a seed and the band's parameters (§6): lanes, appetite range, `pWait` 0.6,
> `waitBudget` 4.
>
> 1. **Plan the munchers** by peeling the picture, as before. The plan now provides only colours
>    and appetites, not the solution. Rejected: an appetite under 4, or fewer than 6 or more than
>    15 munchers (from level 4).
> 2. **Deal dig-wall.**
>    - Planned index i of n gets the key `(i/n)·s + u`: `s = −1` with chance `WALL_REVERSE`
>      (0.8), else +1; `u` uniform in ±`WALL_NOISE` (0.25).
>    - Sorted by key, the munchers are dealt round-robin into the lanes, so inner colours stand
>      at the fronts and must be dug past.
>    - Lanes longer than 5 are rejected.
> 3. **Prove and size** (§4): `minSlots`, the fewest slots that win (1–5). Reject when it is
>    over 5, when a search was cut, or when it is under the band's minimum.
>    `slots = minSlots + slack(kind, band)`; `solution` = the winning path at `slots`.
> 4. **Measure** (§5) and **select** (§6).
>
> The level is its picture and its lanes: no hidden state, no randomness during play.

§4: replace with:

> ## 4. Solver and proof (`src/gen/solve.ts`)
>
> - **Exact search** `solveFrom(game, nodeLimit)`:
>   - depth-first over lane choices on `Game.clone()` copies, finishers first, then eaters;
>   - a transposition table of proven positions (taps are irreversible, so results can be
>     memoised);
>   - returns `solvable | unsolvable | unknown`, and `unknown` is never stored.
> - `minSlots(level)`; `solutionPath(level)` (the winning path the search found); `decisions` and
>   the point of no return for §5. Node limits only (`EXACT_NODE_LIMIT` = 400,000 per query),
>   never time.
> - **Proof of solvability**: `replay(level, level.solution)` ends won within `slots` without
>   boosters, in the tests and the build.

§5: replace with:

> ## 5. Difficulty (measured, `src/gen/metrics.ts`, `src/gen/players.ts`)
>
> Player models, seeded, on the real rules:
> - `random`: a uniform legal lane.
> - `eater`: a front that can eat now, else random.
> - `careful`: a front that can finish, else one that can eat, else random.
> - `digger`: careful; when nothing can eat, the lane whose nearest queued eater is shallowest,
>   up to 5 deep.
> - `skilled`: the digger, which slips to an eater's tap 15 % of the time.
>
> Stored per level (400 playouts each): every model's win rate, `minSlots`, `slack`,
> `decisions`, the skilled player's loss lag (p50, p90), `chains`, `taps`.
>
> A **decision** is a turn on the stored solution where the careful player's top tier holds a
> winning and a losing tap. The **loss lag** counts the taps from the first position the exact
> search proves lost to the loss.

§6: replace the outline bullet, the candidates, the planning peaks, the table and the sawtooth
paragraph with:

> - **Onboarding**: levels 1–3 come from `src/data/onboarding.ts` (hand-made, GDD §8), validated
>   like every level.
> - **Snacks**: levels 4–100 cycle through the 22 snacks of `src/data/snacks.ts` in list order,
>   mirrored on every other pass. Every one meets §6.4.
> - **Kinds**: every 5th level is a breather, every 10th from 20 a peak, the rest normal
>   (levels 4–10 are one band).
> - **Candidates**: up to 160 seeds (`level:n:k`). The first inside every window of its kind and
>   band wins, else the closest. A miss gets 160 more seeds (`level:n:xk`) with the same
>   parameters. The build fails when more than 5 levels miss or any peak misses.
>
> | Levels | Lanes | Appetite | minSlots | Slack | Skilled | Eater | Random | Decisions | Loss lag p90 |
> | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
> | 4–10 | 2–3 | 10–24 | 2 | 1 | ≥ 0.95 | 0.60–0.95 | ≤ 0.70 | — | ≤ 4 |
> | 11–30 | 3 | 10–30 | 3 | 0 | 0.85–0.95 | ≤ 0.65 | ≤ 0.35 | ≥ 1 | ≤ 4 |
> | 31–60 | 3 | 10–30 | 3 | 0 | 0.82–0.94 | ≤ 0.55 | ≤ 0.30 | ≥ 1 | ≤ 4 |
> | 61–100 | 3–4 | 12–30 | 3–4 | 0 | 0.80–0.92 | ≤ 0.50 | ≤ 0.25 | ≥ 2 | ≤ 4 |
> | breathers | band's | band's | band's minimum − 1 (≥ 2) | band's + 1 | ≥ 0.95 | ≥ 0.60 | — | — | — |
> | peaks (20 … 100) | 3 | band's | ≥ 3 | 0 | 0.50–0.70 | ≤ 0.30 | ≤ 0.10 | ≥ 2 | ≤ 4 |
>
> ### 6.4 Snack structure (`src/gen/snack-metrics.ts`, from level 4)
>
> - 12–16 cells per side (12–18 from level 31) and 110–230 pixels.
> - Buried share at the start ≥ 55 %.
> - At least 8 islands (patches with no side on open ground at the start) over at least 3
>   colours.
> - Peel depth ≥ 3.
> - 4–6 colours, each with ≥ 4 pixels.
> - No near-black. Blue and purple, and brown and maroon, never share a snack.

§7: replace the second paragraph with:

> The face has two palettes:
> - **Peek** (during play): every face colour mixed 0.85 towards the hole colour, a dark
>   silhouette with L\* ≤ 25 below every snack colour (L\* ≥ 33). An eaten cell reads as a hole,
>   never as a pixel to eat.
> - **Reveal** (the win): vivid, chroma ≥ 40, L\* 35–75, no nursery pastels. It lights up from
>   the last bite over 500 ms.
>
> Features scale with the grid: on every level's grid each eye is ≥ 2×2 cells (or one ≥ 3×3
> cyclops eye), and the mouth is ≥ 3 cells wide.

§8: replace with the test list of this spec's §9.

---

## 12. What in the uncommitted Epic 4 work must change

Before task A1, the main session commits the Epic 4 tree as built (its gates were green) so the
rework diff is reviewable. Epic 4's pending code-review and audit fold into this epic's end. The
alternative is a 2,000-line uncommitted base under a second large change.

**Keep as built:**
- `hitStop()` and the one clock, `?feelslow`, the camera kick.
- `AudioManager` and the mute, pause and first-gesture rules.
- Haptic patterns.
- The feel log; the `who`-keyed views; the pools (resized).
- `muncher-art.ts` as a pure geometry module and `textures.ts` per colour.
- The capture script.
- D3 and D5–D15.

**Change:**

| File | Change |
| --- | --- |
| `src/game/timeline.ts` | Per-slot tracks with dependency scheduling and hurry (D4′); `fastForward` only in `flush`; `cascade()` re-measured on tracks |
| `src/game/feel.ts` | New and changed constants of §8; `ComboCounter` gets time and decay; `biteDetune(n, appetite, step)` on the pentatonic; `bellyScale(n, appetite)`; `biteInterval(appetite)`; `flightAt(t)` easing; merge-gap constants; `GAIN.ding`; `SFX_PHONE_DB` |
| `src/game/scenes/GameScene.ts` | `drawCell` gets the exposed/buried looks, the glint, holes and peek; front moods from the shown board; the snack-pixel tap bob (V6); the idle hint (R5); a variable slot count from the level (2–5, plus the booster); the win sequence (reveal sweep, radial confetti, panel delay, the level number bright); the merge rules; `confettiColours` without the outline filter |
| `src/game/muncher-art.ts` | Expressions: replace `idle` with `ready`, `peckish`, `sleepy`; `full` becomes blissful; softer brows on `ready`; bigger puff geometry |
| `src/game/textures.ts`, `src/config.ts` | No `d` body; art constants for the moods; `COLOR_HOLE`; slot row for 2–5 slots |
| `src/gen/face.ts` | Peek and reveal palettes; features scaled to the grid; D6's blink and grin kept |
| `scripts/lib/synth.mjs`, `scripts/audio.mjs`, `src/data/audio-manifest.json`, `public/audio/*` | `burp` at ≥ 300 Hz, the new `ding`, a brighter `win` (+6 dB above 400 Hz), the tick tuned to C; re-run `npm run audio`; re-measure `SFX_FILE_DB` and the new `SFX_PHONE_DB` |
| Tests | `tests/feel.test.ts`, `timeline.test.ts`, `cadence.test.ts`, `face.test.ts`, `textures.test.ts`, `audio.test.ts`, `e2e/feel.spec.ts`, `e2e/game.spec.ts`: re-baselined to the new constants and levels (§9). Epic 4 assertions that pin squeezing (D4) are replaced, not deleted silently |
| `scripts/capture.mjs` | Capture a normal level whose stored solution has a double chain, chosen after B5, instead of level 20; every level changes |
| `docs/questions.md`, `docs/PROGRESS.md` | D1 and D2 superseded (F9), D4 replaced by D4′, D5's range updated; the Epic 4 AC table marked "re-baselined in 4R" |

**Remove:**
- `OUTLINE_KEY` and `outline()` from the build.
- The `d` palette entry for snacks, and the ink ring paths.
- `LIGHT_SNACKS` and the planning-peak logic, replaced by kinds and windows.
- The fast-forward-on-tap path.

---

## 13. Task list for the coder (in order; each ends red-test-first, `npm test` and `npm run check` green)

**Phase A: rules and measurement (pure)**

1. **A1 · Flood order** [`src/core/board.ts`, core tests]: R2; worked examples (§11); the
   property test that flood and peel reach the same set. *Check:* core tests green; 2,000-board
   property.
2. **A2 · Slots 2–5** [`src/gen/level.ts`, `src/game/layout.ts`, layout tests]:
   `MIN_SLOTS`/`MAX_SLOTS`, validate, a slot row for 2–6. *Check:* the layout sweep at 2–6 slots.
3. **A3 · Bite ids and deps** [`src/core/game.ts`]: `{ deps: true }`, `reachSince`, events,
   undo. *Check:* the dependency tests; property: undo against replay with deps on.
4. **A4 · Players** [`src/gen/players.ts`]: the five models, `winRate`. *Check:*
   `players.test.ts`.
5. **A5 · Exact search** [`src/gen/solve.ts`]: memo and ordering, `minSlots`, `solutionPath`,
   `decisions`, `pointOfNoReturn`. *Check:* agreement with brute force on 300 small levels; the
   prototype's level 3 numbers reproduced (9 of 21 orders).
6. **A6 · Metrics v2** [`src/gen/metrics.ts`, `level.ts`]: `measure()` returns §4.3.
   *Check:* unit tests on the three onboarding levels.

**Phase B: content and generator**

7. **B1 · Snack metrics and lint** [`src/gen/snack-metrics.ts`, `tests/content.test.ts`].
   *Check:* the six prototype pictures score as in §4.6.
8. **B2 · Onboarding** [`src/data/onboarding.ts`, `tests/onboarding.test.ts`]: §5 verbatim.
   *Check:* the onboarding tests.
9. **B3 · 22 snacks**: three batches of 7–8, each lint-green, plus a 128 px contact sheet for
   the playtester and `design:design-critique`. Remove `d` and the outline. *Check:* lint green;
   design gate notes in docs/questions.md.
10. **B4 · Dig-wall generator and search** [`generate.ts`, `build-levels.ts`, `params.ts`]:
    kinds, bands, windows, staged measurement, early exit, second round. *Check:*
    `tests/gen.test.ts` (determinism; 200 seeds per band valid and proven; hit rate ≥ 3 % per
    window).
11. **B5 · Calibration**: `npm run levels`; report hit rates, misses and build time per band in
    PROGRESS. Widen windows by at most 0.03 per bound where a band yields under 3 %. *Check:*
    ≤ 5 misses, no peak miss, ≤ 5 min on CI.
12. **B6 · Level-list tests** [`tests/levels.test.ts`, `layout.test.ts`]: §9's all-level tests.
    *Check:* green; `levels:check` reproduces.

**Phase C: visibility**

13. **C1 · Cell looks and glint** [`src/game/look.ts` (pure), GameScene `drawCell`].
    *Check:* `look.test.ts`; screenshots of levels 1, 12, 61 at 9:16 for the gate.
14. **C2 · Holes, peek and reveal palettes** [`face.ts`, GameScene]. *Check:* look and face
    tests.
15. **C3 · Front moods** [`muncher-art.ts`, `textures.ts`, GameScene]. *Check:* textures tests
    and the design gate.
16. **C4 · Idle hint** [GameScene, `src/game/hint.ts` (pure, uses `solveFrom`)]. *Check:*
    `e2e/onboarding.spec.ts`.
17. **C5 · Snack-pixel tap bob** [GameScene]. *Check:* e2e "a tap on a red pixel bobs the red
    fronts, nothing else".

**Phase D: feel fixes on Epic 4**

18. **D1 · Tracks, deps and hurry** [`timeline.ts`]. The riskiest task: build it pure first,
    with property tests. *Check:* the timeline tests of §9 and "the settled screen equals the
    rules" e2e.
19. **D2 · Merge rules** [GameScene]. *Check:* e2e "fast taps keep the juice".
20. **D3 · Meal scaling** [`feel.ts`, GameScene]: interval, pentatonic pitch, belly, tick
    thinning. *Check:* feel tests.
21. **D4 · Hop crouch, flight ease, pools** [`feel.ts`, `fx.ts`, GameScene]. *Check:* feel
    tests; the pools e2e.
22. **D5 · Combo decay** [`feel.ts`]. *Check:* feel test.
23. **D6 · Sounds** [synth, audio, manifest]. *Check:* the audio tests (phone band), `audio:check`.
24. **D7 · Win reveal** [GameScene, `fx.ts`]. *Check:* feel.spec win test.
25. **D8 · Muncher faces and puff** [`muncher-art.ts`]. *Check:* textures test and the gate.
26. **D9 · Title muncher** [`TitleScene.ts`]. *Check:* e2e "the Title shows a ready muncher next
    to the play button".

**Phase E: gates and docs**

27. **E1 · Docs**: the GDD and GENERATOR edits (§10–11), docs/questions.md (§16), PROGRESS
    (board, measured: hit rates, the players' band means, the first 30 s), `npm run capture` on
    level 12.
28. **E2 · Team review**: playtester replay (the first 30 s and levels 1–30), `code-review`, the
    adversarial audit. KRİTİK and YÜKSEK closed red-first; then `feat(epic-4r): …`, push, Pages,
    and Hasan's phone check.

---

## 14. Risks

1. **Bots are not people.** Windows tuned on the skilled model can still feel too hard or too
   easy.
   - Mitigation: one table of windows.
   - Hasan plays levels 1–30 on the phone before the release epics.
   - The playtester replays the first 30 s.
   - Moving a window is a one-line change plus a rebuild.
2. **Content cost and quality.** 22 island-rich snacks must also look good at 128 px.
   - Structural metrics can push the art towards "spotty".
   - Mitigation: containers, the design gate per batch, and a fallback of 16 snacks (more
     mirroring) if quality lags.
3. **The parallel timeline** is the most delicate code: causality, slot reuse, the stuck beat,
   Epic 5's undo.
   - Mitigation: build it pure first, give dependencies to the rules (not guesses in the scene),
     property tests at random paces, and keep the screen-equals-rules e2e.
4. **A smaller table than the leaders' five.** Fans may read 3–4 slots as stingy.
   - The +1 slot booster becomes strong, which is good for rewarded ads but risks a "pay to win"
     feeling.
   - Mitigation: every level is proven without boosters; a loss shows its cause within 2 taps;
     breathers every 5 levels.
5. **Yield on the real snacks** may differ from the prototype's four pictures.
   - Mitigation: B5's calibration rule, the second round of seeds, and the build failing loudly
     on misses.
6. **Schedule.** About two weeks before Epics 5–6, inside the genre's estimated 2–4-month window.

---

## 15. Effort (coder-hours, estimate ±25 %)

| Phase | Hours |
| --- | --- |
| A Rules and measurement | 13 |
| B Content and generator (22 snacks ≈ 8 h) | 21 |
| C Visibility | 12 |
| D Feel fixes on Epic 4 (timeline ≈ 6) | 22 |
| E Docs and review fixes | 10 |
| **Total** | **≈ 78** |

---

## 16. Decisions to record (docs/questions.md) and the one question for Hasan

Decisions:
- **R1–R6.**
- **D4′**, replacing D4.
- **F1–F10.**
- **D1 and D2 superseded by F9.**
- **D5** becomes 1–2.5 s.
- **Windows and bands** as in §4.5.
- **Onboarding** levels 1–3 as in §5.
- **Prototype evidence**: the paths above.
- **The Epic 3 open question** on queue depth is closed by R6.
- **The open question "How hard is hard for a person?"** gets the player-model answer, pending
  Hasan's phone check.

Question for Hasan:
- The leaders show five waiting slots. Our measurements say five slots make this rule trivial,
  so the rework plays on a table of 3 (sometimes 4) with one or two munchers that must wait in
  most levels.
- Is a smaller table acceptable for the game's identity, or must it look like five?
- If it must be five, levels need a deeper structure than the generator reached (the expert
  needed 4 slots in only ~3 % of candidates), which means a further rule change.
