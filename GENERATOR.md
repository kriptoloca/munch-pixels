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
- **tap(lane)**: legal when the lane is not empty and a slot is empty. The front muncher moves to
  the leftmost empty slot, then **resolve**.
- **resolve**: repeat until a full pass changes nothing: for each slot from left to right holding
  a muncher m: eat the first min(m.remaining, |Reachable(m.c)|) cells of Reachable(m.c) (each
  becomes EATEN, recomputing open ground before the next muncher); m.remaining −= eaten; when it
  reaches 0 the slot is emptied. Every bite is recorded as an event `{slot, lane, cell, n}` (n =
  bite number within this meal) for the animation, in order.
- **won** ⇔ no PIXEL left. **lost** ⇔ not won, every slot holds a muncher, no muncher can eat
  (guaranteed after resolve) and some lane is not empty.
- **Exact totals** make "all munchers out ⇒ won": if pixels remain and every muncher is in a
  slot, the outermost remaining pixel is exposed, and its colour still has appetite, so resolve
  would eat it.
- **Boosters**: `extraSlot()` adds one empty slot at the right end (once per level); `undo()`
  restores the state before the last tap (a snapshot stack; up to 3 per level).

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
   - append the muncher to the planned order and run `resolve` (waiting munchers eat as soon as
     their pixels open).
   The planned order never needs more than `B + 1 ≤ slots` slots, so it is a solution.
2. **Deal the planned order into lanes.** Each muncher goes to a lane chosen by the seeded RNG
   among the shortest lanes ± 1, keeping the planned order inside every lane. Tapping lanes in
   the planned order is then always legal, so the planned order (as lane indices) is stored as
   `solution`.
3. **Validate** (§1 invariants; the solution replays to a win) and **measure** (§5).

The picture and the lanes are the whole level: no hidden state, no randomness during play.

## 4. Solver and proof (`src/gen/solve.ts`)

- **Proof of solvability**: `replay(level, level.solution)` through `src/core` must end won with
  no booster. This is exact and cheap; every level in the list passes it in the tests and the
  build.
- **Exact search** (`solve(level, nodeLimit)`): depth-first over lane choices with a memo on
  (front indices, slot contents, eaten bitmask); returns `solvable | unsolvable | unknown` and
  the number of nodes. Used by tests on small levels and by the trap metric (§5) when within the
  node limit.

## 5. Difficulty (measured, `src/gen/metrics.ts`)

- `randomWin`: share of 120 seeded playouts won by a player who taps a uniformly random legal
  lane. The main difficulty signal: `difficulty = 1 − randomWin`.
- `greedyWin`: whether a careful player wins who, each turn, prefers a front muncher that can
  eat its whole appetite now, then one that can eat something, then any; ties to the lowest
  lane. A level a careful player loses needs planning.
- `peakSlots`: the most slots the stored solution occupies at once (planned waits + 1).
- `firstMoveTraps`: of the legal first taps, how many lead to a lost position (exact search
  within the node limit; null when unknown).
- `taps`: munchers in the level.

## 6. The level list (`npm run levels` → `src/data/levels.json`)

`scripts/levels.mjs` loads `src/gen/build-levels.ts` through Vite's SSR loader and writes the
list; `npm run levels:check` rebuilds and fails on any difference (CI), so the file is
reproducible. Level n uses the parameters of its band and the snack chosen for it; up to 24
seeds are tried and the candidate whose `difficulty` is closest to the band's target wins.

| Levels | Snacks (size, colours) | Lanes | Appetite | Wait budget B | pWait | Target difficulty |
| --- | --- | --- | --- | --- | --- | --- |
| 1–3 | small (≤ 10×10), 2 colours | 2 | 4–10 | 0 | 0 | 0.00–0.10 (teaching) |
| 4–10 | ≤ 12×12, 2–3 colours | 2–3 | 4–9 | 1 | 0.15 | 0.05–0.25 |
| 11–30 | ≤ 16×16, 3–4 colours | 3 | 3–8 | 2 | 0.25 | 0.20–0.45 |
| 31–60 | ≤ 16×16, 4–5 colours | 3–4 | 3–8 | 3 | 0.30 | 0.35–0.60 |
| 61–100 | ≤ 18×18, 5–7 colours | 4–5 | 3–7 | 4 | 0.35 | 0.45–0.75 |

Sawtooth: every 5th level is a breather (target lowered by 0.15), every 10th a peak (+0.1),
clamped to [0, 0.9]. The tests check that the moving average of `difficulty` over 10 levels
rises from the first to the last band, and that every level validates.

## 7. Hidden face (`src/gen/face.ts`)

`face(seed, w, h)` draws a creature face on the snack's grid: a background colour, a head
shape (round, square-ish, blob), eyes (dot, ring, half-closed, one big eye, star, angry brows),
a mouth (grin, open, fang, tongue, smirk, zigzag), optional ears or horns or antennae, optional
cheeks. Parts and colours come from the seeded RNG; the palette avoids pastel nursery tones
(GDD §4). Pure: returns a grid of colours; the scene draws it under the snack.

## 8. Tests (Vitest)

- Rules: open ground with holes, exposure, reachable order, resolve chains, the four worked
  examples, lose detection, exact-totals completion, undo and extra slot.
- Generator: determinism (same seed → identical level), invariants for 200 seeds per band, the
  planned solution replays to a win with `peakSlots ≤ slots`.
- Solver: `solve` agrees with hand-checked small levels (solvable and unsolvable); `replay`
  rejects an illegal or losing sequence.
- Metrics: a level that needs no choice has `randomWin = 1`; a trap level has `randomWin < 1`.
- Level list: 100 levels, all valid, the difficulty trend rises (moving average), every snack id
  exists, the file matches a fresh build.
- Faces: deterministic, inside the grid, at least two eyes' worth of contrast against the head.
