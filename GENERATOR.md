# GENERATOR.md — rules, level format, generator, solver, difficulty

Everything here is pure TypeScript (no Phaser) under `src/core` (rules) and `src/gen` (content),
deterministic for a seed, unit-tested. The game reads a prebuilt level list
(`src/data/levels.json`, built by `npm run levels`); it never generates levels at runtime in
v0.1.

## 1. Data

### Picture (snack)

```ts
interface Picture { id: string; rows: string[] } // rows[y][x]: '.' transparent or a palette key
```

- Size 6×6 to 20×20 (width = row length, all rows equal), at most 7 colours.
- Palette keys are single letters mapped to the global palette (`src/data/palette.ts`): one
  vivid, distinct colour per key, readable on the board background and on the hidden face.
- Snacks are drawn by hand as data (`src/data/snacks.ts`), original designs only (no IP).

### Level

```ts
interface Muncher { c: string; a: number }        // colour key, appetite ≥ 1
interface Level {
  id: number;            // 1-based position in the list
  snack: string;         // Picture id
  rows: string[];        // the snack as played (a copy, so the list is self-contained)
  lanes: Muncher[][];    // lanes[i][0] is the front
  slots: number;         // waiting slots, 5 in v0.1
  face: number;          // seed of the hidden face (src/gen/face.ts)
  solution: number[];    // lane index per tap; replays to a win (proof of solvability)
  metrics: LevelMetrics; // §5
}
```

Invariants (checked by `validateLevel`, tests and the build script):
1. Every pixel colour has munchers, and the appetites of a colour add up to its pixel count.
2. Every muncher's colour appears in the picture; appetites are integers ≥ 1.
3. `solution` replays through the real rules (§2) to a win without ever needing more than
   `slots` slots and without boosters.
4. 2 ≤ lanes ≤ 5, every lane non-empty, slots = 5.

## 2. Rules (formal; `src/core/board.ts`, `src/core/game.ts`)

Cells: `PIXEL(c)`, `EMPTY` (transparent), `EATEN`. Positions outside the grid are "outside".

- **Open ground** = outside ∪ the EMPTY/EATEN cells connected to the outside through EMPTY/EATEN
  cells (4-neighbourhood). Computed by a flood fill from the border; an enclosed hole is not
  open.
- **Exposed** pixel: a PIXEL with at least one 4-neighbour that is outside or open.
- **Reachable(c)**: flood fill over PIXEL(c) cells, seeded with the exposed PIXEL(c) cells in
  row-major order, expanding to 4-neighbours of colour c (neighbour order: up, left, right,
  down). The fill order is the **eating order**.
- **State**: board, lanes with a front index each, a slot array of length `slots` (each empty or
  a muncher with its remaining appetite), boosters used.
- **tap(lane)**: legal when the game is playing, the lane is not empty and a slot is empty. The
  front muncher moves to the leftmost empty slot, then **resolve**. (After every resolve a
  playing game has an empty slot, because full slots with munchers left in the dens are a loss,
  so the "no slot" case is a guard in the code, never a player-facing result.)
- **resolve**: repeat until a full pass changes nothing: for each slot from left to right holding
  a muncher m: eat the first min(m.remaining, |Reachable(m.c)|) cells of Reachable(m.c) (each
  becomes EATEN, recomputing open ground before the next muncher); m.remaining −= eaten; when it
  reaches 0 the slot is emptied. Every change is recorded as an event, in order, for the
  animation:
  - `hop {lane, index, slot}`: the tapped muncher sits down;
  - `wake {slot}`: a muncher that sat waiting since an earlier tap starts eating again;
  - `bite {slot, cell, n, last}`: n = bites this muncher has taken since it sat down (it keeps
    counting across waits, so the pitch keeps rising), `last` = its appetite is now used up;
  - `full {slot}`: it leaves, the slot is empty;
  - `wait {slot}`: after the loop, a muncher still hungry sits waiting (once per wait);
  - `won` / `lost`.
- **won** ⇔ no PIXEL left. **lost** ⇔ not won, every slot holds a muncher, no muncher can eat
  (guaranteed after resolve) and some lane is not empty.
- **Exact totals** make "all munchers out ⇒ won": if pixels remain and every muncher is in a
  slot, the outermost remaining pixel is exposed, and its colour still has appetite, so resolve
  would eat it.
- **Boosters**: `addSlot()` adds one empty slot at the right end (once per level); on a lost
  level it turns the game back to playing (the lose panel's "continue"). `undo()` restores the
  state before the last tap (a snapshot stack; up to 3 per level, not after a win); slots
  already added stay.
- **Generator and search helpers**: `append(lane, m)` adds a muncher to the back of a lane (only
  the generator, which grows the plan while it plays it); `clone()` copies the position without
  the undo history (the solver and the playouts).

### Worked examples (the unit tests use these)

1. Ring with a buried centre, slots 5:
   ```
   rrr
   rgr
   rrr
   ```
   lanes `[[g1], [r8]]`. Tap lane 0: g sits and waits (centre not exposed). Tap lane 1: r eats
   the 8 ring cells, the centre is exposed, g eats it on the same resolve → won.
2. The same with slots 1: tap lane 0 first → lost (the only slot is blocked). Tap lane 1 first →
   r eats, leaves; tap lane 0 → won.
3. Hole: `rrrr / r.gr / rrrr` with lanes `[[g1], [r3, r7]]` (cells as (x, y)): g waits; r3
   eats (0,0), (1,0), (2,0) — the eating order starts row-major at the exposed cells — and
   eating (1,0) opens the hole at (1,1) to the outside, so g at (2,1) is exposed and g eats on
   the same resolve; r7 then eats the rest → won.
4. Appetite larger than reach: `rrr / rgr / rrr` with lanes `[[r3], [g1], [r5]]`: r3 eats the top
   row; g is exposed through (1,0) and eats on the next tap; r5 eats the rest.

## 3. Generator (`src/gen/generate.ts`)

Input: a picture, a seed and the parameters of its level (§6): lanes `L`, appetite range
`[aMin, aMax]`, wait budget `B` (how many munchers the planned solution may leave waiting at
once, `B ≤ slots − 1`), wait chance `pWait`.

1. **Plan a solution by peeling the picture.** Simulate the real rules from the full board.
   Repeat while pixels are unassigned:
   - list the colours with unassigned pixels; for each, `R_c` = its reachable cells now;
   - with chance `pWait`, and while fewer than `B` planned munchers are waiting, pick a colour
     whose unassigned pixels exceed `|R_c|` and give it an appetite above `|R_c|` (it eats what
     it can and waits): a **planned wait**;
   - otherwise pick a colour with `R_c` non-empty and an appetite `a ≤ |R_c|` from
     `[aMin, aMax]` (it eats at once and leaves);
   - the last muncher of a colour takes exactly the colour's remaining unassigned pixels;
   - the band's appetite range is a target, not a hard limit: a muncher whose colour has fewer
     than `aMin` pixels within reach takes what it reaches (at least 1); one that would leave
     fewer than `aMin` pixels of its colour behind takes them all when it can reach them (at most
     `aMax + aMin − 1`), and otherwise leaves exactly `aMin` behind, which can make it smaller
     than `aMin`;
   - append the muncher to the planned order and run `resolve` (waiting munchers eat as soon as
     their pixels open).
   The planned order never needs more than `B + 1 ≤ slots` slots, so it is a solution.
2. **Deal the planned order into lanes.** With chance `runChance` a muncher queues behind the
   previous one (a **run**, while that lane holds fewer than ⌈n / L⌉ + 1); otherwise it goes to
   a lane chosen by the seeded RNG among the shortest lanes ± 1. The planned order is kept inside
   every lane, so tapping lanes in the planned order is always legal, and the planned order (as
   lane indices) is stored as `solution`. Runs are where the traps come from: the fronts of the
   other lanes belong to later moves, and a hasty player sends them too early.
3. **Validate** (§1 invariants; the solution replays to a win) and **measure** (§5).

The picture and the lanes are the whole level: no hidden state, no randomness during play.

## 4. Solver and proof (`src/gen/solve.ts`)

- **Proof of solvability**: `replay(level, level.solution)` through `src/core` must end won with
  no booster. This is exact and cheap; every level in the list passes it in the tests and the
  build.
- **Exact search** (`solve(rules, nodeLimit)`, `solveFrom(game, nodeLimit)`): depth-first over
  lane choices on `Game.clone()` copies, with a memo on (front indices, slot contents, board
  cells); returns `solvable | unsolvable | unknown` (`unknown` when the node limit is hit). Used
  by tests on small levels and by the trap metric (§5).

## 5. Difficulty (measured, `src/gen/metrics.ts`)

- `randomWin`: share of seeded playouts won by a player who taps a uniformly random legal lane.
  The main difficulty signal: `difficulty = 1 − randomWin`. The search compares candidates on
  120 playouts (`PLAYOUTS`, standard error ≈ 0.045); the chosen level's stored metrics use 1000
  (`METRIC_PLAYOUTS`, ≈ 0.016), so the stored number is the honest one.
- `greedyWin`: whether a careful player wins who, each turn, prefers a front muncher that can
  eat its whole appetite now, then one that can eat something, then any; ties to the lowest
  lane. A level a careful player loses needs planning.
- `peakSlots`: the most slots the stored solution occupies at once (planned waits + 1).
- `firstMoveTraps`: of the legal first taps, how many lead to a lost position (exact search,
  `TRAP_NODE_LIMIT` = 4000 nodes per first tap; null when a search was cut). With 5 slots no
  first tap of the current list is a trap (all 0): the traps sit later in a level. Kept as a
  guard for levels with fewer slots.
- `taps`: munchers in the level.

## 6. The level list (`npm run levels` → `src/data/levels.json`)

`scripts/levels.mjs` loads `src/gen/build-levels.ts` through Vite's SSR loader and writes the
list; `npm run levels:check` rebuilds and fails on any difference (CI), so the file is
reproducible from the code.

- **Snacks**: levels 1–30 meet the 30 snacks in list order (small and few-coloured first).
  Later levels cycle through snacks 10–30 (`SNACK_CYCLE_FROM` = 9; the first nine only teach):
  the **light** snacks (`LIGHT_SNACKS`: apple, cheese, strawberry, cookie, grapes, pear,
  popsicle — few colours or few pixels, they stay easy however they are dealt) come only on
  breather levels, the others on every other level; each cycle mirrors the picture on every
  other pass (`-m` ids).
- **Outline**: from level 4 on, the snack is wrapped in a one-pixel outline of key `d` (a dark
  ink, `src/data/palette.ts`): every transparent cell that touches a pixel and is connected to
  the outside; enclosed holes stay holes. It buries every inner colour until it is eaten
  through, which is where the order of taps starts to matter; without it a random player won
  almost every level (Epic 2 measurement, docs/questions.md).
- **Candidates**: up to 24 seeds (`level:n:k`) with the band's dealing (the lane count comes
  from its own salted stream); the first **hit** wins (difficulty inside the target, and on a
  planning peak a level the greedy player loses), else the best: the closest to the target, and
  on a planning peak a greedy loss first, then the closest. When the closest is still below the target, or a planning peak found no greedy
  loss, a **second round** tries 24 more seeds (`level:n:xk`) with harder dealing
  (`escalate`: one more lane up to 5, wait budget + 1 up to 4, `pWait` + 0.15 up to 0.6,
  `runChance` + 0.2 up to 0.8).
- **Planning peaks**: from level 20, every 10th level prefers a candidate the greedy player
  loses (`isPlanningPeak`), so a few levels ask for thought ahead.

| Levels | Lanes | Appetite | Wait budget B | pWait | runChance | Outline | Target difficulty |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1–3 | 2 | 4–10 | 0 | 0 | 0 | no | 0.00–0.10 (teaching) |
| 4–10 | 2–3 | 4–9 | 1 | 0.15 | 0.2 | yes | 0.05–0.25 |
| 11–30 | 3 | 3–8 | 2 | 0.25 | 0.4 | yes | 0.20–0.45 |
| 31–60 | 3–4 | 3–8 | 3 | 0.30 | 0.5 | yes | 0.35–0.60 |
| 61–100 | 4–5 | 2–6 | 4 | 0.35 | 0.6 | yes | 0.45–0.75 |

Sawtooth: every 5th level is a breather (target lowered by 0.15), every 10th a peak (+0.1),
clamped to [0, 0.9]. The final metrics are measured with their own seed (`level:n:metrics`) and
1000 playouts, so a level whose candidate hit the target on the quick estimate can land outside
it (by up to about 0.1, two standard errors of the quick estimate). The tests check that every level
validates and replays, that the band averages of `difficulty` rise, that levels 1–3 are won by
every random playout, and that planning peaks are lost by the greedy player where the search
found such a candidate (PROGRESS.md lists the measured numbers).

## 7. Hidden face (`src/gen/face.ts`)

`drawFace(seed, w, h)` draws a creature face on the snack's grid (one colour per cell, so it
shows through the eaten cells pixel for pixel): a deep background, a mid-tone head (round,
square or wide), eyes (dot, big, sleepy, cyclops, angry brows), a mouth (grin, open with a
tongue, fang, smirk, zigzag), an extra (none, ears, horns, antenna) and optional cheeks. Parts
come from the seeded RNG (`faceParts`); integer and polynomial geometry only, so every engine
draws the same face. Pure: the scene draws the grid under the snack. The face fills the whole
grid and does not follow the snack's outline, so during play only its cells under pixels show
(some eyes or mouths sit on transparent cells on narrow snacks); the win reveals all of it.

Face colours are a muted "dusty" family (deep backgrounds, mid-tone heads, a warm near-black for
features, a cool pale blue for eye whites), each at least ΔE 18 (CIE76) from every snack colour,
so a revealed face cell never looks like a pixel still to eat; no nursery pastels (GDD §4).

## 8. Tests (Vitest)

- Rules (`tests/core.test.ts`, `tests/core-props.test.ts`): open ground with holes, exposure,
  reachable order, resolve chains, the four worked examples, lose detection, exact-totals
  completion, undo and the extra slot; property tests over 2000 random levels (lost only with
  full slots, a playing game always has a free slot, all munchers out ⇒ won) and undo against a
  fresh replay over 1500 levels.
- Content (`tests/content.test.ts`): at least 24 snacks with unique ids, every snack within the
  size and colour limits with the outline added, the outline as the only exposed colour, the
  snack order per level, distinct palette colours with the outline the darkest.
- Generator (`tests/gen.test.ts`): determinism (same seed → identical level), 200 seeds per
  band give valid levels whose plan replays within the slots, exact appetite totals, dealing keeps
  the plan legal; the solver on hand-checked levels, a trap level, independent clones; band
  targets and the sawtooth.
- Level list (`tests/levels.test.ts`): the 100 levels validate and replay; difficulty rises band
  by band; the face seeds; the planning peaks.
- Faces (`tests/face.test.ts`): determinism, a head and eyes that read against it on small and
  large grids, deep backgrounds and mid-tone heads only (no nursery pastels).
