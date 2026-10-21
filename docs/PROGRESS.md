# PROGRESS.md — where we are

Single source of truth for "where did we leave off". Read first at the start of every session;
update at the end of every epic.

## Status
**Paused 2026-10-21 (Hasan: "move to Shy Ghosts").** Epic 4 (feel and art) committed (6b613db, all 9 audit findings closed); the core rework is specified in docs/core-rework-spec.md and not started; on a return Hasan wants five slots (docs/questions.md) · M1 graybox done 2026-10-19 · Last update: 2026-10-21 · Branch: main
Repo: https://github.com/kriptoloca/munch-pixels

## Session plan (2026-10-21, Epics 4–6, agent team)
Baseline: `main` at 4f6ebfa, 2026-10-21: `npm run check` clean, 95 unit tests pass, `levels:check`
OK; Pages live (run 39481925181). This is the build plan for Epics 4–6; nothing in it is built yet.
The board, Measured and Reviews sections below are updated per epic as usual.

### How the team works (every epic)
1. **Coder**, the only writer: one epic at a time, tasks in the order below. Each task starts with
   its red test and ends with `npm test` and `npm run check` green before the next one starts.
   Every decision goes into docs/questions.md in the same epic (the decisions D1–D15 below too).
2. **Main session**: gates on the finished epic: `npm run check`, `npm test`,
   `npm run levels:check`, `npm run build`, `npm run e2e`, plus `npm run size`.
3. **Gamer** and **auditor**, read-only, in parallel on that tree:
   - gamer: `npm run dev` (port 5173), headless Chromium through Playwright, dev URLs such as
     `/?reset=1&level=20&renderer=canvas&fpsmin=1` (plus `fakeads=1`, and `feelslow=K`, `adfast=1`
     once they exist); reads `window.__munchDebug.state()` (feel log, audio state) and screenshots.
     Judges every GDD §3a row and the `pebblit-game-craft` feel audit (`references/juice.md` §1:
     inversion, dead time, flat repetition, lonely win, masked success) as PASS, TUNE (constant
     name + new value) or FAIL. Its scripts and screenshots stay in its own scratch directory,
     never in the repo. Sound is judged from the feel log and the audio state; ears are Hasan's.
   - auditor: `code-review` of the epic's diff, then the independent adversarial audit against
     GDD.md, GENERATOR.md and CLAUDE.md (KRİTİK / YÜKSEK / ORTA / DÜŞÜK).
4. The coder closes every KRİTİK, YÜKSEK and gamer FAIL with a red-first test, applies TUNE values
   (only in `src/game/feel.ts`, `src/config.ts`, `src/platform/haptics.ts`), closes or records each
   ORTA, and updates this file (board, measured, reviews, next steps) and docs/questions.md.
5. Main session: gates again, commit `feat(epic-N): …`, push to `main`, check the Pages run (deploy
   and e2e-live green).

Standing rules: no new dependency (package.json already pins what is needed: Phaser, Bridge 2.3.1,
sharp, Playwright, fflate; ffmpeg is a system tool used only by `scripts/audio.mjs` (and its
check and tests; CI installs it) and the capture, and their outputs are committed); nothing depends on reading an external site (Bridge names from
docs/bridge-notes.md, fonts vendored, sounds synthesized, no store or name lookups); no model names
in any repo file; text-free gameplay, at most 10 strings in `src/data/strings.ts`; every colour a
player must tell apart is a fill in that colour, never a tint; dev hooks and dev URL parameters only
inside `import.meta.env.DEV` (smoke.spec checks the production bundle); feel e2e run with
`renderer=canvas&fpsmin=1` (Peek & Find lesson: the scene clock keeps wall-clock time on CI).

### Decisions taken for this plan (the docs leave them open)
- **D1** Combo base pitch (GDD §3a: the combo step "raises … the base pitch of the bites", no
  value): `COMBO_CENTS_PER_STEP = 100`; a bite plays at `100 × min(n − 1, 12) + 100 × step` cents.
- **D2** Bite pitch "cap 12" (GDD §3a bite row): from the 13th bite of a meal on, the pitch stays
  at +1200 cents.
- **D3** Hop "pitch by colour index" (GDD §3a hop row): the palette index (`PALETTE` order), so a
  colour hops at the same pitch in every level; `HOP_CENTS_PER_COLOUR = 100`, wrapped in an octave.
- **D4** Squeezed actions (GDD §3a: a new tap squeezes earlier playback "so the new muncher never
  waits"): an action played `fast` gets no hit stop, no kick, no haptic and at most one bite tick
  per frame; its flight, crumbs and counter still play.
- **D5** Cascade per input 0.5–2 s (GDD §3a) applies to taps that end in a full meal. Measured
  2026-10-21 over the 3,723 taps of the stored solutions (Epic 3 timeline timings, the leave
  included): such taps run 0.72–3.02 s, median 1.00 s, 98.6 % inside 0.5–2 s (chains run longer);
  the 445 taps (12 %) that end without a full meal (384 of them a 220 ms hop alone) are tension
  beats: the muncher sits down to wait.
- **D6** The win smile (GDD §2 step 7 and §4 "it smiles"; the §3a win row names the blink and the
  grow): at the win the face blinks once and its mouth is redrawn as the grin variant (a
  `drawFace` option: same seed, only the mouth cells change).
- **D7** Undo (GDD §3a: "the last muncher's bites fly back"; GENERATOR §2: `undo()` restores the
  whole state before the last tap): every bite of the undone tap flies back, chain bites included,
  munchers that left during it reappear in their slots, then the screen is redrawn from the rules.
- **D8** Lose panel (GDD §9 screen 5: "retry (big) and +1 slot"): no undo there. The `slot`
  booster is one per level, either from its button or as the panel's continue.
- **D9** Pause menu (GDD §3a "pause and menu freeze every tween, timer and sound"; §9 screen 6): the
  menu freezes the scene and pauses the music, its own button clicks still sound; it opens over the
  lose panel (Home one tap away, as Peek & Find) and never over the win panel (a tap there
  continues).
- **D10** Interstitial (GDD §9 screen 4, CLAUDE.md rule 6): only on the win panel's continue tap,
  never after a loss or a retry; `AdGate.onSceneCompleted()` on every win; one gate per session
  on `performance.now()`.
- **D11** Share (GDD §5 and §9 screen 4, CLAUDE.md rule 9): the share button on the win panel is
  excluded from "tap anywhere"; the card is a 1080×1080 PNG of the revealed face with the level
  number and the wordmark; the text is one string of `strings.ts`, without a URL (audit-dist
  forbids external URLs, and the portal page is unknown at build time); hidden on YouTube
  (`hostedByYoutube()`); after a refused share and a refused download the button hides for the
  session instead of failing silently.
- **D12** "Screenshots in three aspects" (TASKS Epic 6 AC): 1080×1920, 1080×1080 and 1920×1080
  (Peek & Find's script shoots two; the 1:1 view is added).
- **D13** First upload as version 0.1.0 (package.json), so the ZIP is
  `release/munch-pixels-0.1.0.zip`.
- **D14** The synthesized placeholder sounds and loop ship to the sandbox (brief §12: "an art pass
  after the first sandbox numbers"); real files drop into `assets/audio/` later without code.
- **D15** Dev-only test switches (Peek & Find patterns): `?feelslow=K` stretches every feel timing
  K times, `?adfast=1` starts the session's AdGate 120 s back, `?fakeads=fail` makes fake rewarded
  ads fail.

### Epic 4 — Feel and art (M2)
Risk: the hit stop, kicks and juice run on the custom scene clock next to the fast-forwarding
Timeline; they can break Epic 3's invariants (the settled screen equals the rules after rapid
taps; a pause freezes everything) or stutter on a phone. De-risk: one hit-stop function on both
clocks (tween `timeScale` and the scene clock), restored on the wall clock, never under a pause,
skipped for squeezed actions (D4), built before any juice uses it and tested inside the stop with
`?feelslow=8`; the 19 Epic 3 e2e stay green after every task; pooled flights, crumbs and confetti
with an object-count e2e. Product risk: a muncher that reads baby-faced or a digit that cannot be
read on the small queue munchers; the gamer and the design review look at the art (task 4) before
any juice builds on it.

Tasks, in order (files in brackets):
1. Feel constants and pure helpers [`src/game/feel.ts`, `tests/feel.test.ts`]: every §3a value as a
   named constant (table below); `ComboCounter` (a full in a row +1, a wait resets, cap 3),
   `biteDetune(n, step)` (D1, D2), `hopDetune(paletteIndex)` (D3), `kickIntensity(step)`,
   `bellyScale(n)`, `GAIN`, `SFX_FILE_DB`, `playedDb`, `sumDb`, the `FeelEvent` type.
2. Synthesized sounds [`scripts/lib/synth.mjs`, `scripts/audio.mjs`, `src/data/audio-manifest.json`,
   `public/audio/*.ogg|*.m4a|index.json`, package.json scripts `audio` and `audio:check`, CI step
   `npm run audio:check`, `tests/audio.test.ts`]: the GDD §11 set `hop`, `bite`, `burp`, `perk`,
   `wait`, `nope`, `win`, `stuck`, `pop`, `undo`, `button` and a 16 s `music_loop`; the `bite` tick
   shorter than `BITE_INTERVAL_MS` so 14 ticks a second stay apart; run `npm run audio` here
   (ffmpeg 6.1.1 with libvorbis and aac is installed) and commit the output; measure `SFX_FILE_DB`.
3. Audio runtime [`src/game/audio.ts`, `src/game/audio-keys.ts`, `src/game/scenes/BootScene.ts`,
   `src/game/scenes/TitleScene.ts`, `src/dev/debug.ts`, `tests/e2e/audio.spec.ts`]: port of the
   AudioManager (platform mute wins, a pause silences, nothing before the first gesture, toggles
   persist, `level()` for e2e); Boot loads the audio index and files before the Title (GameReady
   stays after); the music starts on the Title's play tap; dev state `audio`.
4. Muncher art [`src/game/muncher-art.ts` (pure geometry, reused by Epic 6's icon),
   `src/game/textures.ts`, `src/config.ts` (art sizes and colours), `src/game/scenes/GameScene.ts`
   `MuncherView`, `tests/textures.test.ts`]: one body texture per palette colour drawn at Boot
   (the ink `d` keeps its light ring), shared expression overlays (idle, eating, waiting: mouth
   open and eyes up, waking: eyes wide, full: smug, stuck: eyes down), the appetite digit kept
   legible on the queue munchers. Gate before
   task 5: gamer screenshots at 9:16, 1:1 and 16:9 (levels 1, 20, 70) with `design:design-critique`
   and `design:accessibility-review` (13+, never baby-faced; the close pairs red/maroon/pink,
   green/lime, cyan/blue, sand/yellow/cream on the board colour).
5. Hop [GameScene]: squash, arc into the slot, land squash, `hop` at the colour's pitch, haptic
   `hop`; feel log `hop`.
6. Bite stream [GameScene, pooled crumbs]: the pixel lifts and flies on an arc to the mouth,
   shrinking; 3 crumbs in its colour where it stood; the belly swells per bite; the digit drops on
   arrival; the `bite` tick rises per bite; feel log `bite {n, detune, step}`.
7. Hit stop [GameScene, `src/dev/debug.ts`, `src/dev/game-debug.ts`]: the one function of the risk
   note, `?feelslow=K`, camera kicks reset on a pause (`cameras.main.resetFX()`); dev state
   `timeScale`, `hitStops`, `shakeStarts` (counted from the camera's SHAKE_START event).
8. Full meal [GameScene]: the last bite at +2 dB, hit stop, belly bounce, happy face, burp puff,
   waddle off, `burp`, kick by combo step, haptic `full`; `ComboCounter` fed by the played `full`
   and `wait` actions; feel log `full {step, shake}`.
9. Chain and waiting [GameScene]: wake jump with eyes wide and `perk`; waiting face, amber slot and
   a soft `wait`; feel log `wake`, `wait`.
10. Nope [GameScene]: the Epic 3 head shake and front bob plus `nope` at its gain and haptic `nope`;
    no kick, no hit stop; feel log `nope`.
11. Win reveal [`src/gen/face.ts` (eye cells and the grin option, D6), `tests/face.test.ts`,
    GameScene]: the last bite lands, the beat, the win hit stop, blink and smile, the board grows
    with a bounce, pooled confetti (fill colours), `win`, the win kick, haptic `won`; feel log `win`.
12. Stuck [GameScene]: the waiting faces turn down one by one, `stuck` at its gain, haptic `stuck`,
    no kick, the lose panel slides in after the stuck beat; feel log `stuck`.
13. Pause and haptics [GameScene]: `setHapticsEnabled(!paused)`; a pause inside any juice freezes it.
14. Performance [GameScene]: pools for flights, crumbs and confetti; no allocation in `update`; an
    object-count e2e over a long level; `npm run size` (expect well under 3 MB).
15. Cadence and capture [`tests/cadence.test.ts`, `scripts/capture.mjs` + package.json `capture`,
    `docs/capture/level-20.webm`, `docs/capture/level-20-sheet.png`]: the capture plays level 20's
    stored solution through real taps, each tap as soon as the previous cascade has drained,
    records 540×960 (Playwright `recordVideo`, no sound track), keeps the last 10 s (ffmpeg; at that
    pace the window holds about taps 21–33 of 33: the chain wakes of taps 21, 22 and 24, full meals
    and the win with the face) and writes a contact sheet (one frame per 0.5 s, sharp); it fails
    unless the clip's feel log has a wake, at least 3 full meals, the win and no 10 s without a
    finish. Link both files from this document.
16. Gamer feel audit on the sheet and the dev server, TUNE values, then ask Hasan for the phone
    feel check (not blocking the commit).

Reuse from Peek & Find (copy and adapt, no shared package before v0.1 ships):
- `/home/user/peek-and-find/src/game/feel.ts` and `/home/user/peek-and-find/tests/feel.test.ts`
  (pure constants, combo, kick, `playedDb`/`sumDb`, the as-played test).
- `/home/user/peek-and-find/src/game/audio.ts`, `/home/user/peek-and-find/src/game/audio-keys.ts`,
  `/home/user/peek-and-find/src/data/audio-manifest.json`, `/home/user/peek-and-find/scripts/audio.mjs`,
  `/home/user/peek-and-find/scripts/lib/synth.mjs` (tone, noise, mix, arpeggio, music, WAV),
  `/home/user/peek-and-find/tests/pipeline/audio.test.ts`, `/home/user/peek-and-find/docs/audio-review.md`
  (the phone-speaker loudness lesson: loop peak 0.85, music volume 0.5).
- `/home/user/peek-and-find/src/game/assets.ts` (`runLoader` only) and
  `/home/user/peek-and-find/src/game/scenes/BootScene.ts` (load order before the Title).
- `/home/user/peek-and-find/src/game/scenes/GameScene.ts`: `hitStop`/`endHitStop` (lines 965–983),
  `logFeel` (995), the SHAKE_START counter (256), the `feelslow` parsing (≈ 1401).
- `/home/user/peek-and-find/src/game/fx.ts` (`confetti` 192, `sparkle` 165, `flyToHud` 65 for arcs).
- `/home/user/peek-and-find/tests/e2e/feel.spec.ts` (feel log asserts, pause inside the hit stop),
  `/home/user/peek-and-find/tests/tour/` and `/home/user/peek-and-find/scripts/tour-sheet.mjs`
  (contact sheets for the gamer and the design review).
- `/home/user/peek-and-find/.claude/skills/pebblit-game-craft/references/juice.md` (feel audit).

AC → test (TASKS.md Epic 4; constants in `src/game/feel.ts` unless named otherwise):

| AC | Test | GDD §3a constants it pins | Status |
| --- | --- | --- | --- |
| Unit: success outweighs failure, haptics | `tests/haptics.test.ts` › "failure never outweighs success (GDD §3a)" (exists) + "the patterns are the GDD §3a values" (new) | `HAPTIC_PATTERNS` (haptics.ts): hop [10], full [12], nope [8], won [20, 40, 40], stuck [30], booster [10] | green: `tests/haptics.test.ts` (both) |
| Unit: success outweighs failure, sounds as played | `tests/feel.test.ts` › "as played, the full meal and the win outweigh the nope, the wait and the stuck" (full meal ≥ nope + 6 dB and ≥ wait + 6 dB, win ≥ stuck + 6 dB, the nope the quietest cue) | `GAIN.nope` 0.5, `GAIN.stuck` 0.6, `FULL_LAST_BITE_DB` 2, `SFX_FILE_DB` | green: `tests/feel.test.ts` (full meal −12.4 dB, win −13.6, nope −24.0, wait −22.4, stuck −21.7) |
| (the file levels behind it) | `tests/audio.test.ts` › "SFX_FILE_DB matches the shipped files" | `SFX_FILE_DB` (±1 dB) | green: `tests/audio.test.ts` (measured 2026-10-21, ffmpeg volumedetect) |
| E2E feel log: bites ascend in pitch | `tests/e2e/feel.spec.ts` › "bites ascend in pitch: each bite of a meal 100 cents above the last" + `tests/feel.test.ts` › "bite pitch: +100 cents per bite, flat after 12 steps, the combo raises the base" | `BITE_INTERVAL_MS` 70, `BITE_CENTS_PER_BITE` 100, `BITE_PITCH_STEPS` 12, `COMBO_CENTS_PER_STEP` 100 | green: feel.spec + feel.test |
| E2E feel log: a full meal logs a kick | feel.spec › "a full meal: a 45 ms hit stop and a kick; finishes in a row kick harder, a wait resets the step" (level 20 by its solution: the six finishes of taps 2–6 log steps 0, 1, 2, 3, 3, 3; the wait at tap 18 sets the next finish back to step 0) + feel.test › "the kick grows with the combo step, stays small, and the win kick tops it" | `FULL_HIT_STOP_MS` 45, `FULL_SHAKE_MS` 70, `FULL_SHAKE_INTENSITY` 0.002, `SHAKE_STEP_GAIN` 0.25, `COMBO_STEP_CAP` 3, `FULL_BOUNCE_SCALE` 1.2, `LEAVE_MS` 300 | green: feel.spec (18 fulls through tap 19: steps 0,1,2,3,3,3 … 3, then 0) + feel.test |
| E2E feel log: a tap behind the front logs a nope and no camera shake | feel.spec › "a tap behind the front: a nope at its gain, the front bobs, no camera shake, no hit stop" | `NOPE_SHAKE_PX` 6, `NOPE_SHAKE_MS` 40 (two swings), `GAIN.nope` 0.5 | green: feel.spec |
| Muted 10-second capture of level 20 attached to PROGRESS | `npm run capture` (`scripts/capture.mjs`, its own checks above) → `docs/capture/level-20.webm` + `level-20-sheet.png`, linked here; gamer verdict on the sheet | `WIN_BEAT_MS` 250; micro-win cadence (no 10 s without a finish) | green: `npm run capture` → [level-20.webm](capture/level-20.webm), [level-20-sheet.png](capture/level-20-sheet.png) (below); gamer verdict open |

GDD §3a rows beyond the AC, tested in the same epic:

| §3a row | Test | Constants it pins |
| --- | --- | --- |
| Tap a front muncher (hop) | feel.spec › "a hop logs the colour's pitch and lands in its slot" + feel.test › "hop pitch follows the palette index within an octave" | `HOP_SQUASH_X` 1.15, `HOP_SQUASH_Y` 0.85, `HOP_SQUASH_MS` 80, `HOP_MS` 220, `HOP_CENTS_PER_COLOUR` 100 |
| Each bite (flight, crumbs, belly) | feel.test › "belly: +3 % per bite, capped at 30 %"; feel.spec › "pools: a long level ends with the object count of its first tap" | `BITE_FLIGHT_MS` 200, `CRUMBS_PER_BITE` 3, `BELLY_SWELL_PER_BITE` 0.03, `BELLY_SWELL_CAP` 0.3 |
| A waiting muncher wakes; one sits waiting | feel.spec › "a chain: the waking muncher perks and jumps before its first bite; a muncher that cannot eat logs a wait" (level 20, taps 1 and 6) | `WAKE_JUMP_PX` 30, `WAKE_MS` 120 |
| Last pixel (win) | feel.spec › "the last bite lands first; the win follows 250 ms later with a 60 ms hit stop, the biggest kick, the blink and the smile" and "a resize inside the win beat still plays the reveal: one win, the blink, the jingle, the kick" + `tests/face.test.ts` › "the blink touches only the eye cells, the smile only the mouth; the default face is unchanged" and "every eye with whites shuts to a lid as wide as the eye, on odd and even grids" + `tests/layout.test.ts` (the grown board in the overlap test) | `WIN_BEAT_MS` 250, `WIN_HIT_STOP_MS` 60, `WIN_FACE_SCALE` 1.08 (capped per screen by `winScale`), `WIN_SHAKE_MS` 120, `WIN_SHAKE_INTENSITY` 0.0045 |
| Stuck (lose) | feel.spec › "a lost level: faces turn down 80 ms apart, no camera shake, the panel after 600 ms" | `STUCK_STAGGER_MS` 80, `STUCK_MS` 600, `GAIN.stuck` 0.6 |
| Pause vs hit stop | feel.spec › "a platform pause inside the hit stop: the restore resumes nothing" (`?feelslow=8`) | `FULL_HIT_STOP_MS` 45 |
| Squeezed playback (D4) | `tests/e2e/game.spec.ts` › the rapid-taps test extended: "squeezed actions log no hit stop and no kick" | `FAST_FORWARD_MS` 150, `FAST_FLIGHT_MS` 80 |
| Cascade per input (D5) | `tests/cadence.test.ts` › "a tap that ends in a full meal releases 0.5–2 s of motion: median inside, ≥ 95 % inside over the stored solutions" | `HOP_MS`, `BITE_INTERVAL_MS`, `BITE_FLIGHT_MS`, `LEAVE_MS` |
| Platform mute wins (GDD §11) | `tests/e2e/audio.spec.ts` › "a platform mute silences the win jingle already playing (CLAUDE.md rule 4)" and "a platform pause silences the win jingle already playing (CLAUDE.md rule 4)": master bus < 0.0005 150 ms into the jingle, the music back on unmute / resume (audit fix: until then only the music paused and a ringing SFX played on); "silent before the first tap; music after the Title's play tap, SFX on taps" covers the first gesture only | `AudioManager.refresh()` mutes the master bus on platform mute or pause |

Status 2026-10-21: every row above is green, under the planned names, with three differences:
the win test plays level 1 (short) instead of level 20; the pause-inside-the-stop test starts the
stop through the dev hook `__munchDebug.hitStop(ms)` (a full meal's stop lasts 45 ms × feelslow,
too short to hit reliably from outside); D4's assertions extend the Epic 3 rapid-taps test in
place (its name kept, so the 19 Epic 3 tests stay countable). Added beyond the plan: feel.spec
"the hit stop holds the scene clock and the tweens, restored on the wall clock" and "haptics buzz
the GDD patterns; a pause inside the bite stream freezes it and silences them",
`tests/cadence.test.ts` "micro-win cadence", `tests/textures.test.ts` (8: one body per colour,
the ink ring, shapes in the box, expressions, the digit never covered, feature contrast, digit
legibility on every screen, no `setTint`), a timeline test for the stuck beat.

Done when: every row above is green; check, test, levels:check, build and e2e green; initial load
< 8 MB; the capture and its sheet in `docs/capture/` and linked here; gamer: no FAIL, no inversion,
no masked success; the design and accessibility notes closed or recorded; code-review and audit
KRİTİK/YÜKSEK closed; this file (board, measured: audio sizes, cascade numbers, capture facts) and
docs/questions.md (D1–D7, D14, D15) updated; `feat(epic-4): …` pushed, Pages deploy and e2e-live
green; Hasan asked for the phone feel check.

### Epic 5 — Platform, boosters and ads
Risk: undo reverses a tap that may have triggered chains (munchers that left come back, face
cells close again) while the Timeline still holds squeezed actions, and a +1 slot bought inside the
600 ms stuck beat must cancel a pending `lost` (docs/questions.md, Epic 3 note). De-risk: undo is
flush → `rules.undo()` → redraw from the rules (the resize path the "screen equals the rules" e2e
already proves), with the reverse flights as a cosmetic layer on top (D7); the probe also compares
the face cells on screen with the rules' eaten cells; a seeded random e2e of taps, undos and +1
slot against the rules; `Timeline.cancelLost()` unit-tested first.

Tasks, in order:
1. One freeze [`src/game/scenes/GameScene.ts`, `TitleScene.ts`, `tests/e2e/platform.spec.ts`,
   `tests/e2e/helpers.ts`]: `applyFreeze()` with frozen = platform pause or menu: tweens, scene
   clock, pending hit stop, camera kick, audio, haptics; Phaser HIDDEN/VISIBLE stand in for the
   stub's pause; a dim (alpha 0.55) above everything on the Game and the Title; helpers `setHidden`,
   `setSdkAudio`, `meanLuma` (sharp).
2. Mute end to end [`tests/e2e/audio.spec.ts`]: the SDK audio state silences music and SFX while play
   goes on; pause and mute win over the toggles.
3. Lifecycle [GameScene, `docs/bridge-notes.md`]: `gameplay_started` at the level start, after
   Resume, after a rewarded ad on a playing level and after continue; `gameplay_stopped` at win,
   lose, menu open and before every ad; level messages through `track` (exist).
4. HUD buttons [`src/game/hud.ts`, `src/game/glyphs.ts`, `src/game/boosters.ts`,
   `tests/boosters.test.ts`]: pause button at `layout.pause`, booster buttons at `layout.boosters`
   (glyphs: pause, home, sound on/off, music on/off, +slot, undo arrow, ad mark), a press acts on a
   pointer-up over the same button, hidden without rewarded support; booster availability pure.
5. Rewarded path [GameScene, `src/platform/bridge.ts` (`?fakeads=fail`)]: `adInProgress` blocks
   every input; `gameplay_stopped` before, `afterAd()` (`regainFocus`, re-read the platform pause),
   `gameplay_started` after; `track('ad_rewarded_shown')`, `track('booster_used')`.
6. +1 slot [GameScene, `src/game/timeline.ts`, `tests/timeline.test.ts`]: `rules.addSlot()`, redraw
   with six slots, the new slot pops in (`SLOT_POP_MS`, `pop`, haptic `booster`); inside the stuck
   beat `Timeline.cancelLost()` and the stuck faces go back to waiting.
7. Lose-panel continue [GameScene]: the rewarded `slot` button on the lose panel when supported and
   unused (D8): playing again, panel gone.
8. Undo [GameScene, `src/dev/game-debug.ts`]: per-tap event lists kept in step with the rules'
   history; flush, `rules.undo()`, reverse flights (`UNDO_FLIGHT_MS` 40, `undo`), the muncher hops
   back, redraw from the rules, revealed cells closed again; up to 3, never after a win, not on a
   panel; probe `revealedMismatch`.
9. Interstitial [GameScene]: a module-level `AdGate` on `performance.now()` (`?adfast=1`),
   `onSceneCompleted()` on each win, on the win panel's continue: support + gate → `markShown` →
   `showInterstitial()` with every input blocked and no countdown → `afterAd()` → next level (D10);
   `track('ad_interstitial_shown')`.
10. Pause menu [`src/game/menu.ts`, GameScene, `tests/e2e/menu.spec.ts`]: Resume, Sound, Music,
    Home (D9); toggles through `audio.toggleSetting` (persisted); a platform resume over the open
    menu stays frozen; Home goes to the Title.
11. Analytics [`src/platform/analytics.ts`, `tests/analytics.test.ts`]: `session_end` on `pagehide`;
    booster and ad events counted in the dev state, never forwarded.
12. Host iframe [`tests/e2e/platform.spec.ts`]: port the blur-pause, wake-tap and ad-focus cases.
13. Gamer pass with `?fakeads=1`: boosters rescue and never gate, no ad right after a loss, the
    interstitial cadence; then fixes.

Reuse from Peek & Find:
- `/home/user/peek-and-find/src/game/scenes/GameScene.ts`: `setPaused` (312), `afterAd` (333),
  `applyFreeze` (346), `openMenu` (374), `closeMenu` (413), `onMenuTap` (441), `advance` with the
  session `adGate` (709, 129), `onContinue` (1210) and `onHint` (1228) as the rewarded pattern,
  `dimContainer` (1286), `goHome` (1312), the HIDDEN/VISIBLE fallback (≈ 261–271).
- `/home/user/peek-and-find/src/game/textures/placeholders.ts` lines 389–490 (speaker, slash, note,
  home and pause drawings) for `src/game/glyphs.ts`.
- `/home/user/peek-and-find/tests/e2e/menu.spec.ts`, `player.spec.ts` (fake ads, "no interstitial
  before 120 s"), `host.spec.ts` (iframe host), `audio.spec.ts` (mute and pause through the host
  path), `helpers.ts` (`setHidden` 200, `meanLuma` 212, `setSdkAudio` 222).

AC → test (TASKS.md Epic 5; e2e with `?fakeads=1` unless noted):

| AC | Test | Constants it pins | Status |
| --- | --- | --- | --- |
| Boosters work and are real button taps: +1 slot | `tests/e2e/boosters.spec.ts` › "+1 slot: a real tap on the button, a sixth slot pops in and the next muncher sits in it" | `EXTRA_SLOTS_PER_LEVEL` 1 (core), `SLOT_POP_MS`, haptic booster [10] | planned |
| … undo | boosters.spec › "undo: a real tap takes back the last tap, chain bites included; the screen equals the rules; three per level" | `UNDOS_PER_LEVEL` 3 (core), `UNDO_FLIGHT_MS` 40 | planned |
| … mixed | boosters.spec › "taps, undos and +1 slot in a seeded random order: the settled screen always equals the rules" | — | planned |
| … continue on the lose panel | boosters.spec › "lose, continue on the lose panel, playing again with six slots; the slot booster is spent" | `STUCK_MS` 600 | planned |
| … inside the stuck beat | boosters.spec › "+1 slot bought inside the stuck beat cancels the lose panel" + `tests/timeline.test.ts` › "cancelLost drops a pending lose and keeps every other action" | `STUCK_MS` 600 | planned |
| … unsupported or failing (CLAUDE.md rule 6) | boosters.spec › "without rewarded support no booster or continue is drawn and the level still plays to a win" (no `fakeads`) and "a failed rewarded ad gives nothing and play goes on" (`fakeads=fail`) + `tests/boosters.test.ts` | — | planned |
| No interstitial before 3 levels … | `tests/e2e/ads.spec.ts` › "no interstitial before three levels, even with 120 s gone" (`adfast=1`) + `tests/ads.test.ts` (4 tests, exist) | `SCENES_PER_INTERSTITIAL` 3 | planned |
| … and 120 s | ads.spec › "no interstitial before 120 s, even after four levels" | `MIN_INTERVAL_MS` 120000 | planned |
| (the gate open) | ads.spec › "three levels and 120 s: the interstitial plays on the win panel's tap, blocks every tap, then the next level starts" | `BRIDGE_MIN_INTERSTITIAL_DELAY_S` 120 | planned |
| Platform pause freezes the bite stream … | `tests/e2e/platform.spec.ts` › "host pause (page hidden): the bite stream freezes, the screen dims, nothing moves; resume plays it on" (the SDK path; game.spec covers the dev path) | — | planned |
| … and blocks taps | platform.spec › "taps during a host pause do nothing; in an iframe host the wake tap is not a game tap" | `RESUME_TAP_GRACE_MS` 350 | planned |
| Mute silences | `tests/e2e/audio.spec.ts` › "platform mute silences music and SFX while play goes on; the toggles stay on" | — | planned |
| (pause menu, lifecycle, analytics) | `tests/e2e/menu.spec.ts` › "the menu freezes everything; sound and music toggle in place and persist; Resume plays on", "a platform resume over the open menu keeps the game frozen", "the menu opens over the lose panel, never over the win panel", "Home returns to the Title", "Bridge messages: gameplay_started and gameplay_stopped around the menu, ads, win and lose"; `tests/analytics.test.ts` › "booster and ad events are counted, never forwarded; session_end on page hide" | — | planned |

Done when: every row green; the whole e2e suite also green without `fakeads` (ads unsupported);
check, test, levels:check, build and e2e green; gamer verdict recorded; code-review and audit
KRİTİK/YÜKSEK closed; docs/bridge-notes.md (lifecycle as built), docs/questions.md (D7–D10, D15) and
this file updated; `feat(epic-5): …` pushed, Pages deploy and e2e-live green.

### Epic 6 — Title, brand, store, release (M3)
Risk: the share button inside Playgama's iframe (the Web Share API needs the host's permission
policy and a sandboxed frame may refuse downloads) and the name check, which needs a browser this
session does not have. De-risk: a pure `shareMode()` with feature detection, the button hiding
itself after a refused share and download (D11), e2e with a stubbed `navigator.share` and a YouTube
host (`window.ytgame` set by an init script), Hasan's check on the sandbox page; the name lives in
one string and the wordmark is regenerated by `npm run brand`, so a rename costs minutes.

Tasks, in order:
1. Brand [`assets/brand/fonts/` (Outfit and Bricolage Grotesque with their OFL texts, copied),
   `scripts/brand.mjs`, `docs/store/brand/*`, `public/brand/wordmark.png`, `public/brand/pebblit.png`,
   `src/game/brand.ts`, package.json `brand`]: the Munch Pixels icon drawn from
   `src/game/muncher-art.ts` through Vite's SSR loader (as `scripts/levels.mjs` loads TypeScript):
   one fat muncher with a pixel on its lip, a half-eaten snack, one accent (GDD §4); wordmark dark
   and transparent; the Pebblit cairn; `canvas-design` principles and `design:design-critique` at
   128 px.
2. Boot [`BootScene.ts`]: the wordmark texture and the progress bar (text fallback); GameReady as
   before.
3. Title [`TitleScene.ts`, `tests/e2e/title.spec.ts`]: logo, the big play button with the level
   number, sound and music toggles (`audio.toggleSetting`), an idling muncher next to the button
   (the front muncher of lane 0 of the level to play), the cairn small, the pause dim, re-layout on
   resize in 9:16, 1:1 and 16:9.
4. Share [`src/game/share.ts`, GameScene win panel, `src/data/strings.ts`, `tests/share.test.ts`,
   `tests/e2e/share.spec.ts`]: D11.
5. Store images [`scripts/screenshots.mjs`, `scripts/thumbnails.mjs`, package.json `screenshots`,
   `thumbnails`]: screenshots of the Title, level 1, level 20 mid-stream and a win face in the three
   aspects of D12 (fails on a blank shot); Playgama covers 800×800, 1080×1920, 1920×1080 and the
   512 icon from a real level and the wordmark; outputs git-ignored (already in .gitignore).
6. Store text [`docs/store/listing.md`, `thumbnail-brief.md`, `video-script.md`, `submission.md`,
   `launch-plan.md`, `tests/store.test.ts`]: through `design:ux-copy` and the brand voice
   (`/home/user/peek-and-find/.claude/brand-voice-guidelines.md` v1.2: "Pebblit Games", US English,
   no exclamation marks or superlatives, never kids, children, toddler, baby or preschool, no
   off-platform calls to action on YouTube Playables); the clip and hook "What was under the snack?"
   (launch report §4); the launch plan through `game-trend-skills:launching-on-zero-budget`.
7. Size, version, ZIP [`scripts/size.mjs` (`--report`, initial load per audio format),
   `docs/size-report.md`, package.json version 0.1.0 (D13), `tests/zip.test.ts`]: `npm run zip`, then
   the file name, size and SHA-256 into `docs/store/submission.md`.
8. Certification [`docs/certification-checklist.md`]: every CLAUDE.md platform rule with its
   evidence; device rows open for Hasan; walk it with `engineering:deploy-checklist`.
9. Gamer pass: the one-line test (a face, a cascade, something to send) on the Title, the win card
   and the screenshots; then fixes.
10. Hasan: name check, upload, QA tool, phone check (below).

Reuse from Peek & Find:
- `/home/user/peek-and-find/scripts/brand.mjs`, `/home/user/peek-and-find/assets/brand/fonts/`,
  `/home/user/peek-and-find/src/game/brand.ts`, `/home/user/peek-and-find/docs/store/brand/README.md`
  and `philosophy.md` (Field & Signal; the cairn).
- `/home/user/peek-and-find/src/game/scenes/TitleScene.ts` (wordmark with text fallback, studio mark,
  toggles, pause dim, GameReady once) and `/home/user/peek-and-find/src/game/scenes/BootScene.ts`
  (brand preload, boot screen).
- `/home/user/peek-and-find/scripts/screenshots.mjs` (add the 1:1 view),
  `/home/user/peek-and-find/scripts/thumbnails.mjs` (covers), `/home/user/peek-and-find/scripts/size.mjs`.
- `/home/user/peek-and-find/docs/store/listing.md`, `submission.md`, `thumbnail-brief.md`,
  `video-script.md`, `launch-plan.md`; `/home/user/peek-and-find/tests/store.test.ts`;
  `/home/user/peek-and-find/tests/pipeline/zip.test.ts`;
  `/home/user/peek-and-find/docs/certification-checklist.md`; `/home/user/peek-and-find/docs/size-report.md`.
- `/home/user/peek-and-find/reports/2026-10-20-launch-pebblit.md` §4 (hooks: "What was under the
  snack?", the level 70 random-player line) and §5 (placements).

AC → test (TASKS.md Epic 6):

| AC | Test / check | Status |
| --- | --- | --- |
| ZIP within limits | `npm run zip` (`scripts/lib/zip.mjs` fails on a file over 30 MB, a pre-compressed file, a missing root `index.html`) + `tests/zip.test.ts` (port) + the CI `zip:only` artifact | planned |
| … with SHA in `docs/store/submission.md` | `tests/store.test.ts` › "submission.md records the ZIP of the current version with a 64-hex SHA-256" | planned |
| Screenshots in three aspects | `npm run screenshots` (non-zero exit unless every 1080×1920, 1080×1080 and 1920×1080 shot has content) + `tests/e2e/title.spec.ts` › "the Title lays out in 9:16, 1:1 and 16:9" + the existing 1:1 and 16:9 game e2e | planned |
| Hasan: Playgama upload and QA tool | `docs/certification-checklist.md` row "Playgama QA tool: all checks pass" (device) | Hasan |
| Hasan: phone check | checklist row "20 consecutive levels on a phone without frame drops" (CLAUDE.md, project done) | Hasan |
| (store text) | `tests/store.test.ts` › "no file under docs/store uses the banned audience words", "the listing has the title, a pitch of at most 90 characters, three description lines and five tags", "the public listing text has no exclamation marks, uses US spelling and names Pebblit Games" | planned |
| (share) | `tests/share.test.ts` › "hidden on YouTube; share where a PNG can be shared; download otherwise; hidden after both were refused"; `tests/e2e/share.spec.ts` › "the win panel shares one PNG face card; a tap elsewhere goes to the next level", "inside the YouTube host there is no share button" | planned |
| (Title and brand) | title.spec › "the Title shows the wordmark texture, the play button with the level, two toggles and an idling muncher", "sound and music toggles are real taps and survive a reload"; smoke.spec (GameReady once, after the Title is interactive) | planned |

Done when: every row green except the two Hasan rows; check, test, levels:check, build, e2e,
`npm run size` (initial load < 8 MB), `npm run zip` and `npm run screenshots` done; the store text
passed `design:ux-copy` and the brand voice; the checklist complete except its device rows;
code-review and audit KRİTİK/YÜKSEK closed; this file and docs/questions.md (D11–D13) updated;
`feat(epic-6): …` pushed, Pages deploy and e2e-live green; then Hasan's upload. M3 (brief §10) is
done when Hasan's QA-tool and phone rows are ticked.

### Needs Hasan
- Before Epic 6 task 6 (the listing): check the name "Munch Pixels" on Playgama, YouTube Playables
  and Google Play (this session reaches only the npm registry). Recommendation: keep it unless a
  live game has the exact name; fallback "Pixel Munchers" (one string plus `npm run brand`).
- Optional now: the M1 phone check under "Hasan's steps" on the live /test/ page; its answers on the
  "+N" queues and the difficulty feed Epic 4's tuning (default until then: as built).
- After Epic 4: a phone feel check at https://kriptoloca.github.io/munch-pixels/test/?reset=1&level=20
  with sound on (an Android phone also shows the haptics). Built 2026-10-21; asked for once the
  epic is pushed (not blocking the commit).
- After Epic 6: Playgama "Add Game" with `release/munch-pixels-0.1.0.zip` (SHA-256 in
  docs/store/submission.md; the AI-agent field is filled at upload), the QA tool run, and the phone
  check (20 levels without frame drops, the share button on the sandbox page, pause and mute from
  the QA tool).

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
| 4 | Feel and art (M2) | built and audited 2026-10-21 (9 findings closed); core rework next | feel constants and helpers (D1–D4), 11 synthesized sounds + 16 s loop (`npm run audio`, `audio:check` in CI), AudioManager (platform mute wins, pause silences, nothing before the first tap), procedural munchers (one body per colour, 7 shared overlays, queue digits 0.55 of their size), hop / bite stream / full meal / chain / wait / nope / win reveal (blink + grin, D6) / stuck beat, one hit-stop function on both clocks, pooled effects, `?feelslow=K`; 137 unit + 35 e2e (19 Epic 3, 3 audio, 13 feel); capture of level 20 linked below |
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

## Measured (Epic 4, 2026-10-21)
- **Capture** (`npm run capture`, scripts/capture.mjs): [docs/capture/level-20.webm](capture/level-20.webm)
  (10.0 s, 540×960, VP8, no sound track, 327 KB) and its contact sheet
  [docs/capture/level-20-sheet.png](capture/level-20-sheet.png) (20 frames, 0.5 s apart, 120 KB).
  The clip holds taps 24–33 of 33: 10 hops, 52 bites, a chain wake, 12 full meals and the win
  (8.5 s: the blink and the burp puffs; 9.0 s: the grin, the board grown, confetti). Longest
  stretch without a finish: 2.5 s over the whole level as played headless, 1.5 s inside the clip.
  The script anchors the clip on the win frame (docs/questions.md, Epic 4: Playwright's
  screencast lags).
- **Cascade per input** (D5, `cascade()` with Epic 4's exit and hit stops, all 3,723 taps of the
  stored solutions): taps that end in a full meal run 0.89–3.37 s, median 1.17 s, 97.7 % inside
  0.5–2 s (`tests/cadence.test.ts`); at the capture's pace the longest stretch without a finish
  in any level is 3.3 s (level 53). Level 20 at that pace: 24.9 s of timeline, tap 21 at 14.9 s.
- **Sounds** (`public/audio`, 12 placeholders): OGG 119 KB, M4A 160 KB (music loop 64 KB / 132
  KB). File levels (`SFX_FILE_DB`, dBFS mean): hop −15.9, bite −11.3, burp −12.8, perk −17.6,
  wait −17.2, nope −18.0, win −13.6, stuck −17.3, pop −15.3, undo −16.1, button −15.2; bite tick
  45 ms (< the 70 ms interval). As played (file + gain): full meal −12.4 dB (last bite +2 dB),
  win −13.6, hop −20.3, perk −20.7, wait −22.4, stuck −21.7, nope −24.0 (the quietest); margins
  full − nope 11.6 dB, full − wait 10.0 dB, win − stuck 8.1 dB.
- **Size** (`npm run size`): production tree 1.89 MB (30 files), initial load 1.89 MB of the 8 MB
  target; the bundle 1,355 KB, the Bridge 300 KB.
- **Pools**: flights 8, crumbs 24, puffs 9, confetti 36 per board; a paced playthrough of level
  26 (100+ bites) grows none and ends with the object count of its first tap (feel.spec).
- **Art**: muncher textures 192 px (14 bodies, 14 overlays: 7 expressions × 2 tones), drawn at
  Boot; digits ≥ 30 design px on 9:16, 20:9, 1:1 and 16:9 (front 0.28 of the muncher, queue
  0.55 of the mini: 34 px on 9:16). The "+N" chip is 1.2× the queue digit: 41 px on 9:16, 20:9
  and 16:9, 36 px on 1:1 (audit fix: it was 31 and 28 px).
- **Win grow** (`winScale`, audit fix: 1.08 covered the slot frames on 9:16 and 1:1 and ran past
  the left edge on 16:9), over the 100 levels: 9:16 and 20:9 median 1.063, the full 1.08 on 36
  levels, ≤ 1.01 on 11 (square snacks that fill their box); 1:1 median 1.069 (49 full); 3:4
  median 1.023 (12 full); 16:9 1.048–1.08, median 1.060 (23 full).
- **Gate (coder, 2026-10-21, in this order):** `npm run check` clean; `npm test` 125 passed (21
  files); `npm run levels:check` OK (100 levels reproduced in 111.9 s); `npm run build` OK
  (audit-dist: 30 files, no external URLs); `npm run e2e` 31 passed (19 Epic 3, 1 audio, 11 feel;
  2.4 min); `npm run size` 1.89 MB; `npm run audio:check` OK.
- **Gate after the audit fixes (coder, 2026-10-21, in this order):** `npm run check` clean;
  `npm test` 137 passed (23 files); `npm run levels:check` OK (111.4 s); `npm run build` OK
  (audit-dist: 30 files, no external URLs); `npm run e2e` 35 passed (19 Epic 3, 3 audio, 13
  feel; 3.0 min); `npm run size` 1.89 MB; `npm run audio:check` OK (durations included);
  `npm run audio` re-encodes the placeholders byte for byte.
- **Coder's feel pre-check** (`pebblit-game-craft` references/juice.md §1, before the gamer's
  independent pass): no inversion (camera, hit stop and the longer haptics only on success; the
  nope is the quietest cue); no dead time (input stays open, a meal's cascade ~1.2 s); no flat
  repetition (+100 cents per bite, combo base pitch and kick, cap 3); no lonely win (a finish at
  least every 3.3 s at the capture's pace); no masked success (the last meal lands, the win 250 ms
  later). Watch items for the gamer: the bite tick's level against the music on a phone speaker
  (GAIN.bite), confetti size (CONFETTI_PX 16), the 1:1 queue munchers' size.

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

- Epic 4 (2026-10-21): the coder's task-4 design gate and feel pre-check are in docs/questions.md
  (Epic 4) and Measured (Epic 4) above.
- Epic 4 adversarial audit: 0 KRİTİK, 1 YÜKSEK, 2 ORTA, 6 DÜŞÜK — every finding closed, each bug
  with a red test first. YÜKSEK: a platform mute or pause left an SFX already playing audible (the
  win jingle rang on); the master bus is muted now (`audio.spec` › "a platform mute / pause
  silences the win jingle already playing"). ORTA: a resize inside the 250 ms win beat skipped
  the reveal, and a flushed full meal or wait skipped the combo; the combo is fed in `apply`
  and a flushed win plays its reveal after the redraw (feel.spec › the two "a resize …" tests).
  ORTA: `scripts/audio.mjs` piped sources into ffmpeg, so a drop-in M4A with its index at the
  end came out as a silent stub with success reported; sources go by path with `-xerror`, and
  `audio:check` compares every file's duration with its source (`tests/audio-encode.test.ts`; CI
  installs ffmpeg). DÜŞÜK: the blink split a centred cyclops eye (grouped per eye now,
  `tests/face.test.ts`); the win grow covered neighbours (`winScale`, `tests/layout.test.ts`);
  each landing allocated its sound options (a scratch object, `tests/source-rules.test.ts`);
  tuning numbers in fx.ts and audio.ts (moved to feel.ts and config.ts, same test file); the "+N"
  chip smaller than the queue digits (`chipFontPx`, `tests/textures.test.ts`; `LABEL_STROKE`
  and `LABEL_FONT_SHARE` removed); `cascade()` counted the win and stuck beats, and the squeezed
  sound gate outlived a level restart (`tests/timeline.test.ts`, `tests/feel.test.ts`).
- Epic 4 playtest (2026-10-21): "a Food Hunt or Colony Flow! fan still leaves by level 5". Core
  reasons: no decisions, tiny meals, the rule hard to read. Feel and art: tapping fast strips the
  juice, the reveal is dull, the faces read mean, phone speakers lose the burp. All of these go
  to the core rework that follows (its spec is written separately); nothing of it is built in
  Epic 4.

## Hasan's steps (outside the code)
- [x] Turn on GitHub Pages once: done, Pages is live. The deploy job of pages run 39481925181
      (2026-10-20) succeeded (its build and e2e-live jobs too):
      https://kriptoloca.github.io/munch-pixels/ (production build) and
      https://kriptoloca.github.io/munch-pixels/test/ (development build with the dev shortcuts).
- [ ] Then on the phone: https://kriptoloca.github.io/munch-pixels/test/?reset=1 — play levels
      1–10 (and `?level=20`, a planning peak). Tell me: is it readable (pixels, the queue digits),
      do the taps land, is anything confusing, too easy or too hard? Does the "+N" (munchers not
      shown yet in long queues) bother you, or is the visible depth enough? Graybox look: discs
      and digits now; the munchers' faces, sounds and juice come in Epic 4.

## Next steps (in order)
0. Paused (2026-10-21): nothing below starts until Hasan resumes Munch Pixels.
1. On a return: design a rule change that keeps five waiting slots (Hasan) and still forces
   decisions, prove it with the spec's player models before any code (docs/questions.md).
2. The core rework (docs/core-rework-spec.md): the playtest's core reasons (no decisions, tiny
   meals, the rule hard to read) and its feel and art issues (fast taps strip the juice, a dull
   reveal, mean-looking faces, the burp lost on phone speakers).
3. Epic 5 platform, boosters (+1 slot, undo) and ads; Epic 6 Title, brand, store, release.
4. After Hasan's phone check: tune the band targets and decide the open questions (queue depth
   vs lane length, difficulty for people).
