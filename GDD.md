# Munch Pixels — Game Design Document v0.1

Studio: Pebblit (@pebblitgames) · Working title: **Munch Pixels** (name check open, docs/questions.md)
Platforms: Playgama (Bridge, web portals) first, then YouTube Playables with the same build.
Language: text-free gameplay; digits are allowed (appetite counters, level number).
Origin: idea A of `peek-and-find/reports/2026-10-19-ideas-next-game.md` (the pixel-eating sort
riser: Food Hunt: Pixel Puzzle #1 and Colony Flow! #4 on the September 2026 trending chart),
designed with the `pebblit-game-craft` skill (Face, Feel, Flow, Fair, Share).

## 1. One line

Hungry little munchers eat a pixel-art snack colour by colour; tap one, and the pixels of its
colour lift off the picture and fly into its mouth one by one until it is full, burps and
waddles off; under the snack, a face peeks through.

The one-line test (`pebblit-game-craft`): a muted 3-second clip shows a face (the munchers and
the hidden face), a cascade after one tap (a stream of pixels boarding a muncher, tick by tick)
and ends with something to send (the revealed face card).

## 2. Core loop

1. The level shows a **snack**: a pixel picture (up to 20×20 cells, usually 12–16) with a
   transparent background, a few colours.
2. Below the snack sits a row of **5 waiting slots** (the table), and below that the **dens**:
   2–5 lanes, each a queue of munchers. Each muncher has a colour and an **appetite** (a number
   of pixels it must eat). All queues are visible.
3. The player taps the **front muncher of a lane**. It hops into the leftmost free slot.
4. A muncher in a slot eats every pixel of its colour it can **reach** (rules in §3), in a
   fixed order, until its appetite is used up. Each bite: a pixel lifts off the snack and flies
   into its mouth.
5. A full muncher burps and leaves; its slot is free again.
6. A muncher that cannot reach enough pixels **waits** in its slot, mouth open. When other
   munchers uncover pixels of its colour, it wakes up and eats on its own (chain reactions).
7. **Win**: the snack is gone. The face under it is complete; it smiles, and the level ends.
8. **Lose**: all slots hold waiting munchers and none of them can reach anything. The player
   can retry, or take **+1 slot** (rewarded) and play on.

No timer, no hearts, no stars in v0.1. A level is the same for every player (fixed level list),
so "level 37 is hard" means the same thing to everyone.

## 3. Rules (exact; GENERATOR.md §2 holds the formal version)

- **Open ground**: everything outside the picture, plus every transparent or eaten cell
  connected to the outside through transparent or eaten cells. An enclosed hole is not open
  until something next to it is eaten.
- **Exposed pixel**: a pixel with a side (4-neighbour) on open ground.
- **Reachable pixels of colour c**: the pixels of colour c connected through pixels of colour c
  to an exposed pixel of colour c. Munchers tunnel through their own colour, never through
  another.
- **Eating order**: breadth-first from the exposed pixels of that colour (ties in row-major
  order), so the outside goes first.
- **Resolution** after every tap: slots are visited left to right; each muncher eats
  min(remaining appetite, reachable pixels) of its colour; a muncher at zero leaves; repeat
  until nothing changes. Eating opens ground, so one muncher's meal can wake another.
- **Exact appetite**: for every colour, the appetites of its munchers add up to its pixel count.
  So once every muncher is out of the dens, the snack always finishes.
- **No free slot**: a tap on a den does nothing but a soft "nope" (§3a).
- **Lose** is decided after resolution: all slots taken (by munchers that cannot eat) and the
  dens are not empty.

## 3a. Feel spec (`pebblit-game-craft` workflow A)

Rule: the right move is the loudest moment; failure stays local and soft. Values are starting
points behind named constants in `src/game/feel.ts`, tuned on Hasan's phone.

| Action → outcome | Visual | Sound | Screen | Haptic (Android) |
| --- | --- | --- | --- | --- |
| Tap a front muncher, a slot is free | squash 1.15/0.85 for 80 ms, hop on an arc into the slot in 220 ms, land squash | `hop`, pitch by colour index | none | 10 ms |
| …each bite | the pixel lifts, shrinks and flies into the mouth on an arc in 200 ms; 3 crumbs where it stood; the belly swells 3 % per bite (cap 30 %); the counter drops on arrival | `bite` tick, +100 cents per bite of this meal (cap 12), bites every 70 ms | none | none |
| …the last bite (full) | hit stop 45 ms, belly bounce 1.2×, happy face, burp puff, then waddle off in 300 ms | `bite` at +2 dB, then `burp` | kick 70 ms, 0.002 × (1 + 0.25 × combo step) | 12 ms |
| A waiting muncher wakes (chain) | it jumps 30 px, eyes open wide, then eats as above | `perk` | none | none |
| Muncher arrives and cannot eat yet | sits with mouth open, eyes look up at the snack, slot outline turns amber | soft `wait` | none | none |
| Tap with no free slot | the front muncher shakes its head ±6 px × 2 (40 ms each); the slots flash amber 200 ms | `nope`, gain 0.5 | none | 8 ms |
| Tap on a muncher that is not at the front | nothing (no sound) | — | — | — |
| Last pixel (win) | its own beat: the bite lands, then 250 ms later hit stop 60 ms, the face blinks and grows 1.08× with a bounce, confetti | `win` jingle | kick 120 ms, 0.0045 | 20-40-40 ms |
| Stuck (lose) | the waiting munchers turn their faces down, one by one 80 ms apart; the panel slides in after 600 ms | `stuck`, gain 0.6 | none | 30 ms |
| Booster +1 slot | a sixth slot pops in with a bounce | `pop` | none | 10 ms |
| Booster undo | the last muncher's bites fly back to the snack in reverse, quickly (40 ms each), it hops back to its den | `undo` | none | none |

- **Combo step** = munchers that finished in a row without any muncher sitting down to wait;
  first finish = step 0, cap 3. It raises the full-meal kick and the base pitch of the bites.
- **Cascade per input**: one tap releases 0.5–2 s of motion the player does not drive (the hop,
  then 4–20 bites at 70 ms, then the burp); chain reactions extend it.
- **Micro-win cadence**: a muncher finishes every 1–3 s of play; check on a recording that no
  stretch of 10 s passes without a finish.
- **Input stays open** during bites; taps queue nothing, they act at once (a second muncher can
  hop in while the first eats).
- **Pause and menu** freeze every tween, timer and sound (tweens and the scene clock); a pending
  hit stop never resumes a paused game.
- **Failure never outweighs success**: haptics and the sounds as played (file level + gain) are
  unit-tested for it, as in Peek & Find.
- **iPhone**: no Vibration API on the web, so the hand-feel there is visual and audio only.

## 4. Face

- **Munchers**: round blobs, one per colour, with big eyes and a big mouth; full = round and
  smug, waiting = mouth open, eyes up; stuck = eyes down. Original design, drawn procedurally at
  boot (no runtime tint; every colour variant drawn into its own texture).
- **The hidden face**: under every snack sits a face (a "peeker"), generated from parts (eye
  shape, mouth, cheeks, ears, colour); it shows through the eaten cells and smiles when the snack
  is gone. 13+ and never baby-faced (no nursery palette; same rule as Peek & Find).
- Thumbnail at 128 px: one fat muncher with a pixel on its lip, a half-eaten snack, one accent.

## 5. Share

The win screen shows the revealed face with the level number, large and clean: the share
object. On web portals a share button (Web Share API, download fallback) arrives in E6; on
YouTube Playables the button is hidden (no off-platform actions). v2: an album of found faces.

## 6. Fair

- Every level is generated with a known solution and verified by a solver that it is solvable
  **without boosters** (GENERATOR.md §4).
- Difficulty is measured, not guessed: the win rate of a random player over many playouts, the
  number of trap moves, and the slots the solution needs (GENERATOR.md §5).
- A loss always has a visible cause: munchers sitting in amber slots, mouths open.
- Boosters rescue; they never gate a level. Ads only behind the gate (§7), never after every
  level (the complaint in the leaders' reviews, 2026-10-19).

## 7. Monetization (Playgama Bridge 2.3.1, same wrapper as Peek & Find)

- **Rewarded**: `slot` (+1 slot for this level, once per level; also offered on the lose panel
  as "continue"), `undo` (undo the last tap, up to 3 per level). Both hidden when rewarded ads
  are not supported; the game stays complete without them.
- **Interstitial**: between levels only, when BOTH hold: ≥ 3 levels completed since the last one
  (or the session start) AND ≥ 120 s since the last one; `setMinimumDelayBetweenInterstitial(120)`
  as the second guard. Never a countdown.
- No IAP, no banners, no off-platform links.

## 8. Progression and saves

Fixed level list (100 levels in v0.1, built by `npm run levels`, GENERATOR.md §6); after the
last level the list repeats from level 51 with fresh seeds (v0.2; v0.1 shows the last level
again). Save (Bridge storage, localStorage in dev): `{ version, level, sound, music,
levelsCompleted, facesFound }`. Saved after every level and every setting change; never blocks
or throws.

## 9. Screens

1. **Boot**: wordmark + progress bar (our own; the Bridge logo off). GameReady only when the
   Title is interactive.
2. **Title**: logo, a big play button with the level number, sound and music toggles. A muncher
   idles next to the button.
3. **Game**: snack, slots, dens; level number top left, pause button; booster buttons (`+slot`,
   `undo`) bottom corners when rewarded is supported.
4. **Win**: the face, big, with the level number; tap anywhere → next level (or the
   interstitial when the gate allows).
5. **Lose**: retry (big) and +1 slot (rewarded, when supported).
6. **Pause menu**: resume, sound, music, home (as Peek & Find v1.6).

## 10. Layout (same scale rules as Peek & Find)

Design size: short side 1080, long side follows the viewport aspect, clamped to [1080, 2400];
`Scale.FIT`; `setGameSize` on every resize, then `layout()`. Portrait (primary): HUD band, snack
square (up to 900 px), slot row, dens. Landscape: snack left, slots and dens right. 1:1: a
smaller snack, slots and dens below. `computeLayout` is pure and unit-tested.

## 11. Audio

Synthesized placeholders like Peek & Find (`scripts/lib/synth.mjs` → OGG + M4A): `hop`,
`bite`, `burp`, `perk`, `wait`, `nope`, `win`, `stuck`, `pop`, `undo`, `button`, a 16 s music
loop. Platform mute always wins; in-game toggles never override it.

## 12. Platform rules (YouTube Playables, all hard; CLAUDE.md)

No external network calls; initial load ≤ 8 MB target, 30 MB hard; GameReady when interactive;
pause/mute from the host stop everything; 9:16, 1:1 and 16:9 all correct; text-free gameplay;
13+; no third-party IP; no off-platform links on YouTube.

## 13. Out of scope for v0.1

Accounts, backend, leaderboard, daily level, album screen, level editor, IAP, localisation of
UI strings beyond the ≤ 10 strings, more than two boosters, obstacles (ice, locks), hidden
queues.
