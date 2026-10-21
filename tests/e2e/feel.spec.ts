import { expect, type Page } from '@playwright/test';
import { PALETTE } from '../../src/data/palette';
import type { FeelEvent } from '../../src/game/feel';
import {
  BITE_FLIGHT_MS,
  BITE_INTERVAL_MS,
  FULL_HIT_STOP_MS,
  FULL_LAST_BITE_DB,
  GAIN,
  NOPE_BOB_PX,
  STUCK_MS,
  STUCK_STAGGER_MS,
  WAKE_JUMP_PX,
  WAKE_MS,
  WIN_BEAT_MS,
  WIN_FACE_SCALE,
  WIN_HIT_STOP_MS,
  WIN_SHAKE_INTENSITY,
  dbGain,
  hopDetune,
  kickIntensity,
} from '../../src/game/feel';
import type { MunchDebugState } from '../../src/dev/debug';
import { CANVAS, TEST, state, tapPoint, test, waitState } from './helpers';

/**
 * Feel pass (GDD §3a, `pebblit-game-craft`): the right move is the loudest moment, failure stays
 * local and soft. The dev state carries a feel log (scene clock), the hit stops, the camera
 * shakes started (counted from the camera's own SHAKE_START event) and the time scale, so the
 * cascade is checked without guessing frames. Canvas + `?fpsmin=1` keep the scene clock on
 * wall-clock time on the GPU-less machine (Peek & Find lesson); `?feelslow=8` stretches every
 * feel timing where a test must act inside one.
 */
const CLOCK = `${CANVAS}&fpsmin=1`;

type Game = NonNullable<MunchDebugState['game']>;

function feel(s: MunchDebugState, level: number, kind?: FeelEvent['kind']): FeelEvent[] {
  return (s.game?.feel ?? []).filter((e) => e.level === level && (!kind || e.kind === kind));
}

async function now(page: Page): Promise<Game> {
  const s = await state(page);
  if (!s?.game) throw new Error('no game state');
  return s.game;
}

/** Plays taps of the stored solution, each once the previous cascade has drained. */
async function playPaced(page: Page, lanes: readonly number[]): Promise<void> {
  for (const lane of lanes) {
    await tapPoint(page, `lane:${String(lane)}`);
    await waitState(page, (x) => x.game?.pending === 0, 'cascade drained');
  }
}

async function open(page: Page, level: number, extra = ''): Promise<Game> {
  await page.goto(`${TEST}?reset=1&level=${String(level)}${CLOCK}${extra}`, { waitUntil: 'load' });
  const s = await waitState(page, (x) => x.game?.inputOpen === true, `level ${String(level)}`);
  if (!s.game) throw new Error('no game state');
  return s.game;
}

test("a hop logs the colour's pitch and lands in its slot", async ({ page }) => {
  const g0 = await open(page, 20);
  const lane = g0.solution[0] as number;
  const key = g0.frontKeys[lane] as string;
  await tapPoint(page, `lane:${String(lane)}`);
  const s = await waitState(page, (x) => feel(x, 20, 'hop').length === 1, 'hop logged');
  const hop = feel(s, 20, 'hop')[0] as FeelEvent;
  expect(hop.detune).toBe(hopDetune(Object.keys(PALETTE).indexOf(key)));
  expect(hop.slot).toBe(0);
  expect(hop.fast).toBe(false);
  expect(hop.haptic).toBe('hop');
  expect(s.audio?.played).toContain('hop');
  // it lands in its slot (the rules' seat, settled on screen; the hop tween may end a frame
  // after the timeline's last action on a loaded machine)
  const settled = await waitState(
    page,
    (x) => x.game?.pending === 0 && x.game.mismatches.length === 0,
    'settled in its slot',
  );
  const seat = settled.game?.screen.seats[0];
  const slot = settled.game?.slots[0];
  expect(seat && slot && Math.hypot(seat.x - slot.x, seat.y - slot.y)).toBeLessThan(1);
  expect(settled.game?.mismatches).toEqual([]);
});

test('bites ascend in pitch: each bite of a meal 100 cents above the last', async ({ page }) => {
  const g0 = await open(page, 20);
  const [first, second] = g0.solution as [number, number];
  await tapPoint(page, `lane:${String(first)}`);
  await waitState(page, (x) => x.game?.pending === 0 && feel(x, 20, 'hop').length === 1, 'tap 1');
  await tapPoint(page, `lane:${String(second)}`);
  const s = await waitState(
    page,
    (x) => feel(x, 20, 'bite').length === 6 && x.game?.pending === 0 && x.game.pool.active === 0,
    'six bites of tap 2, crumbs settled',
  );
  const bites = feel(s, 20, 'bite');
  expect(new Set(bites.map((b) => b.who)).size).toBe(1);
  expect(bites.map((b) => b.n)).toEqual([1, 2, 3, 4, 5, 6]);
  expect(bites.map((b) => b.detune)).toEqual([0, 100, 200, 300, 400, 500]);
  expect(bites.every((b) => b.step === 0 && b.fast === false)).toBe(true);
  // the stream: a bite every 70 ms of scene time (scheduled; played on the frames after)
  const at = bites.map((b) => b.at ?? 0);
  for (let i = 1; i < at.length; i++) {
    expect((at[i] as number) - (at[i - 1] as number)).toBeCloseTo(BITE_INTERVAL_MS, 6);
  }
  const first6 = bites[0] as FeelEvent;
  const last6 = bites[5] as FeelEvent;
  expect((last6.t - first6.t) / 5).toBeGreaterThanOrEqual(50);
  expect((last6.t - first6.t) / 5).toBeLessThanOrEqual(100);
  expect(s.audio?.played).toContain('bite');
  // crumbs and flights came from the warm pools and went back
  expect(s.game?.pool.crumb).toBeGreaterThanOrEqual(3);
  expect(s.game?.pool.grown).toBe(0);
});

test('the hit stop holds the scene clock and the tweens, restored on the wall clock', async ({
  page,
}) => {
  const g0 = await open(page, 20, '&feelslow=8');
  expect(g0.timeScale).toBeCloseTo(1 / 8, 6);
  await page.evaluate(() => window.__munchDebug?.hitStop?.(45));
  const inStop = await now(page);
  expect(inStop.timeScale).toBe(0);
  expect(inStop.hitStops).toBe(g0.hitStops + 1);
  await page.waitForTimeout(150); // inside the 360 ms (45 ms × 8) stop
  expect((await now(page)).clock).toBe(inStop.clock);
  const after = await waitState(page, (x) => (x.game?.clock ?? 0) > inStop.clock, 'clock runs');
  expect(after.game?.timeScale).toBeCloseTo(1 / 8, 6);
});

test('a platform pause inside the hit stop: the restore resumes nothing', async ({ page }) => {
  const g0 = await open(page, 20, '&feelslow=8');
  await tapPoint(page, `lane:${String(g0.solution[0])}`);
  await waitState(page, (x) => feel(x, 20, 'hop').length === 1, 'a hop in the air');
  // the stop and the pause in one frame: the pause lands inside the stop
  await page.evaluate(() => {
    window.__munchDebug?.hitStop?.(45);
    window.__munchDebug?.pause?.(true);
  });
  const frozen = await now(page);
  expect(frozen.timeScale).toBe(0);
  await page.waitForTimeout(1000); // the wall-clock restore ran under the pause
  const later = await state(page);
  expect(later?.paused).toBe(true);
  expect(later?.game?.timeScale).toBeCloseTo(1 / 8, 6);
  // nothing resumed: the scene clock and every object stood still
  expect(later?.game?.clock).toBe(frozen.clock);
  expect(later?.game?.motion).toBeCloseTo(frozen.motion, 6);
  expect(later?.game?.shaking).toBe(false);
  await page.evaluate(() => window.__munchDebug?.pause?.(false));
  await waitState(
    page,
    (x) => !x.paused && (x.game?.clock ?? 0) > frozen.clock,
    'plays on after the resume',
  );
});

test('a full meal: a 45 ms hit stop and a kick; finishes in a row kick harder, a wait resets the step', async ({
  page,
}) => {
  const g0 = await open(page, 20);
  await playPaced(page, g0.solution.slice(0, 19));
  const s = await waitState(
    page,
    (x) => x.game?.pending === 0 && x.game.timeScale === 1 && (x.audio?.counts.burp ?? 0) >= 18,
    'tap 19 drained, its hit stop over, its burp out',
  );
  const fulls = feel(s, 20, 'full');
  // tap 1 waits; taps 2–6 finish six munchers (tap 6 wakes the first one): 0, 1, 2, 3, 3, 3
  expect(fulls.slice(0, 6).map((f) => f.step)).toEqual([0, 1, 2, 3, 3, 3]);
  // through tap 17 the run goes on at the cap; tap 18 sits down to wait; tap 19 starts over
  expect(fulls).toHaveLength(18);
  expect(fulls[16]?.step).toBe(3);
  expect(fulls[17]?.step).toBe(0);
  for (const f of fulls) {
    expect(f.fast).toBe(false);
    expect(f.hitStop).toBe(FULL_HIT_STOP_MS);
    expect(f.shake).toBeCloseTo(kickIntensity(f.step ?? 0), 12);
    expect(f.haptic).toBe('full');
  }
  // every finish started its own kick and its own hit stop
  expect(s.game?.shakeStarts).toBe(g0.shakeStarts + 18);
  expect(s.game?.hitStops).toBe(g0.hitStops + 18);
  // the last bite of every meal is 2 dB louder
  const loud = feel(s, 20, 'bite').filter((b) => (b.gain ?? 0) > GAIN.bite + 1e-9);
  expect(loud).toHaveLength(18);
  for (const b of loud) expect(b.gain).toBeCloseTo(GAIN.bite * dbGain(FULL_LAST_BITE_DB), 12);
  // every full meal burps, also when the next tap hurries the muncher out of its slot
  expect(s.audio?.counts.burp).toBe(18);
  expect(s.game?.timeScale).toBe(1);
});

test('a chain: the waking muncher perks and jumps before its first bite; a muncher that cannot eat logs a wait', async ({
  page,
}) => {
  const g0 = await open(page, 20);
  await playPaced(page, g0.solution.slice(0, 1));
  const s1 = await waitState(
    page,
    (x) => feel(x, 20, 'wait').length === 1 && x.game?.mismatches.length === 0,
    'tap 1 sits down to wait',
  );
  const hop = feel(s1, 20, 'hop')[0] as FeelEvent;
  const wait = feel(s1, 20, 'wait')[0] as FeelEvent;
  expect(wait.who).toBe(hop.who);
  expect(wait.gain).toBeCloseTo(GAIN.wait, 12);
  expect(wait.shake).toBe(0);
  expect(wait.haptic).toBeNull();
  // mouth open, eyes up at the snack, the slot amber
  expect(s1.game?.screen.seats[0]?.face).toBe('waiting');
  expect(s1.game?.screen.amber[0]).toBe(true);
  expect(s1.audio?.counts.wait).toBe(1);

  await playPaced(page, g0.solution.slice(1, 6));
  const s6 = await waitState(page, (x) => feel(x, 20, 'wake').length === 1, 'tap 6 wakes it');
  const wake = feel(s6, 20, 'wake')[0] as FeelEvent;
  expect(wake.who).toBe(wait.who);
  expect(wake.jump).toBe(WAKE_JUMP_PX);
  // its next bite comes after the wake's jump (scheduled exactly WAKE_MS later)
  const next = feel(s6, 20, 'bite').find((b) => b.who === wake.who && b.t >= wake.t);
  expect(next).toBeDefined();
  expect((next as FeelEvent).at).toBeCloseTo((wake.at ?? 0) + WAKE_MS, 6);
  expect((next as FeelEvent).t).toBeGreaterThan(wake.t);
  expect(s6.audio?.counts.perk).toBeGreaterThanOrEqual(1);
});

test('a tap behind the front: a nope at its gain, the front bobs, no camera shake, no hit stop', async ({
  page,
}) => {
  const g0 = await open(page, 20);
  await tapPoint(page, 'behind:0');
  const s = await waitState(page, (x) => feel(x, 20, 'nope').length === 1, 'nope logged');
  const nope = feel(s, 20, 'nope')[0] as FeelEvent;
  expect(nope.gain).toBeCloseTo(GAIN.nope, 12);
  expect(nope.haptic).toBe('nope');
  expect(nope.shake).toBe(0);
  expect(nope.hitStop).toBe(0);
  // the front muncher of its lane bobs once: it is the one to tap
  expect(nope.jump).toBe(NOPE_BOB_PX);
  expect(s.audio?.counts.nope).toBe(1);
  await page.waitForTimeout(400);
  const after = await now(page);
  expect(after.shakeStarts).toBe(g0.shakeStarts);
  expect(after.hitStops).toBe(g0.hitStops);
  expect(after.taps).toBe(0);
  expect(after.mismatches).toEqual([]);
});

test('the last bite lands first; the win follows 250 ms later with a 60 ms hit stop, the biggest kick, the blink and the smile', async ({
  page,
}) => {
  const g0 = await open(page, 1);
  await playPaced(page, g0.solution);
  const s = await waitState(
    page,
    (x) => x.game?.panel === 'win' && x.game.timeScale === 1 && x.game.boardScale > 1,
    'the win, its stop over',
  );
  const win = feel(s, 1, 'win')[0] as FeelEvent;
  const bites = feel(s, 1, 'bite');
  const last = bites[bites.length - 1] as FeelEvent;
  // its own beat: the last pixel lands, then 250 ms of scene time, then the win
  expect(win.at).toBeCloseTo((last.at ?? 0) + BITE_FLIGHT_MS + WIN_BEAT_MS, 6);
  expect(win.t).toBeGreaterThan(last.t + BITE_FLIGHT_MS);
  expect(win.hitStop).toBe(WIN_HIT_STOP_MS);
  expect(win.haptic).toBe('won');
  expect(win.shake).toBe(WIN_SHAKE_INTENSITY);
  for (const f of feel(s, 1, 'full')) expect(win.shake).toBeGreaterThan(f.shake ?? 0);
  expect(s.game?.shakeStarts).toBe(g0.shakeStarts + feel(s, 1, 'full').length + 1);
  expect(s.audio?.counts.win).toBe(1);
  // the face blinked once and grins; the board grew with a bounce (WIN_FACE_SCALE, capped where
  // it would reach a neighbour) and stays big
  expect(s.game?.blinks).toBe(1);
  const grown = await waitState(
    page,
    (x) => x.game?.smile === true && Math.abs((x.game.boardScale ?? 0) - x.game.winScale) < 1e-6,
    'the grin, the board grown',
  );
  expect(grown.game?.winScale).toBeGreaterThan(1);
  expect(grown.game?.winScale).toBeLessThanOrEqual(WIN_FACE_SCALE);
  expect(grown.game?.panel).toBe('win');
  expect(grown.game?.blinks).toBe(1);
  // confetti came from its warm pool
  expect(grown.game?.pool.grown).toBe(0);
});

test('a resize inside the win beat still plays the reveal: one win, the blink, the jingle, the kick', async ({
  page,
}) => {
  const g0 = await open(page, 1, '&feelslow=8');
  const sol = g0.solution;
  // every tap at once: the rules settle at once, the timeline squeezes all but the last meal
  for (const lane of sol) await tapPoint(page, `lane:${String(lane)}`);
  // the last pixel has landed and the win waits out its beat (250 ms × 8 of wall time)
  const beat = await waitState(
    page,
    (x) =>
      feel(x, 1, 'full').length === sol.length &&
      feel(x, 1, 'win').length === 0 &&
      (x.game?.pending ?? 0) > 0,
    'inside the win beat',
  );
  await page.setViewportSize({ width: 430, height: 844 });
  const s = await waitState(page, (x) => x.game?.panel === 'win', 'the win after the redraw');
  // the redraw played the pending win as its reveal, not as a silent end state
  expect(feel(s, 1, 'win')).toHaveLength(1);
  expect(s.game?.blinks).toBe(1);
  expect(s.game?.hitStops).toBe((beat.game?.hitStops ?? 0) + 1);
  expect(s.game?.shakeStarts).toBe((beat.game?.shakeStarts ?? 0) + 1);
  expect(s.audio?.counts.win).toBe(1);
  const grown = await waitState(
    page,
    (x) =>
      x.game?.smile === true &&
      x.game.timeScale > 0 &&
      Math.abs((x.game.boardScale ?? 0) - x.game.winScale) < 1e-6,
    'the grin, the board grown',
  );
  expect(grown.game?.blinks).toBe(1);
  expect(grown.game?.mismatches).toEqual([]);
});

test('a resize that flushes a full meal still counts it: the next finish takes the next step', async ({
  page,
}) => {
  const g0 = await open(page, 20, '&feelslow=8');
  const sol = g0.solution;
  // tap 1 sits down to wait; tap 2 finishes a meal (step 0), tap 3 the next one (step 1)
  await playPaced(page, sol.slice(0, 1));
  await tapPoint(page, `lane:${String(sol[1])}`);
  await waitState(page, (x) => x.game?.taps === 2, 'tap 2 taken');
  await page.setViewportSize({ width: 430, height: 844 });
  const flushed = await waitState(page, (x) => x.game?.pending === 0, 'the redraw');
  // tap 2's meal was flushed by the redraw, never played
  expect(feel(flushed, 20, 'full')).toHaveLength(0);
  await playPaced(page, sol.slice(2, 3));
  const s = await waitState(page, (x) => feel(x, 20, 'full').length === 1, "tap 3's full meal");
  expect(feel(s, 20, 'full')[0]?.step).toBe(1);
  expect(feel(s, 20, 'full')[0]?.shake).toBeCloseTo(kickIntensity(1), 12);
});

test('a lost level: faces turn down 80 ms apart, no camera shake, the panel after 600 ms', async ({
  page,
}) => {
  await open(page, 20);
  const taps = await page.evaluate(() => window.__munchDebug?.losingTaps?.() ?? null);
  if (!taps) throw new Error('no losing order');
  await playPaced(page, taps.slice(0, -1));
  const before = await now(page);
  await tapPoint(page, `lane:${String(taps[taps.length - 1])}`);
  const s = await waitState(
    page,
    (x) => x.game?.panel === 'lose' && x.game.panelReady,
    'the lose panel, ready',
  );
  const turns = feel(s, 20, 'stuck');
  const beat = turns[0] as FeelEvent;
  expect(beat.n).toBe(0);
  expect(beat.gain).toBeCloseTo(GAIN.stuck, 12);
  expect(beat.haptic).toBe('stuck');
  expect(beat.shake).toBe(0);
  // every waiting muncher turns its face down, slot by slot, 80 ms apart
  expect(turns.map((e) => e.slot)).toEqual([0, 1, 2, 3, 4]);
  turns.forEach((e, k) => {
    expect(e.at).toBeCloseTo((beat.at ?? 0) + k * STUCK_STAGGER_MS, 6);
    expect(e.t).toBeGreaterThanOrEqual(e.at ?? 0);
  });
  expect(turns.slice(1).every((e) => e.gain === 0 && e.haptic === null)).toBe(true);
  expect(s.game?.screen.seats.map((x) => x?.face)).toEqual(Array(5).fill('stuck'));
  // failure stays soft: no kick, no hit stop
  expect(s.game?.shakeStarts).toBe(before.shakeStarts);
  expect(s.game?.hitStops).toBe(before.hitStops);
  // the panel comes STUCK_MS after the beat began
  expect(s.game?.panelAt ?? 0).toBeGreaterThanOrEqual((beat.at ?? 0) + STUCK_MS);
  expect(s.audio?.counts.stuck).toBe(1);
  expect(s.game?.mismatches).toEqual([]);
});

test('haptics buzz the GDD patterns; a pause inside the bite stream freezes it and silences them', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __vibes: unknown[] };
    w.__vibes = [];
    // writable: Phaser's feature check assigns navigator.vibrate to itself at boot
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      writable: true,
      value: (p: unknown) => {
        w.__vibes.push(p);
        return true;
      },
    });
  });
  const vibes = (): Promise<unknown[]> =>
    page.evaluate(() => (window as unknown as { __vibes: unknown[] }).__vibes);
  const g0 = await open(page, 20);
  // tap 1 hops and waits, tap 2 hops, eats and finishes: hop, hop, full
  await playPaced(page, g0.solution.slice(0, 2));
  await waitState(page, (x) => x.game?.timeScale === 1, 'stop over');
  expect(await vibes()).toEqual([[10], [10], [12]]);
  await tapPoint(page, 'behind:0');
  await waitState(page, (x) => feel(x, 20, 'nope').length === 1, 'nope');
  expect(await vibes()).toEqual([[10], [10], [12], [8]]);

  // tap 3: pause while its pixels are in the air
  await tapPoint(page, `lane:${String(g0.solution[2])}`);
  await waitState(
    page,
    (x) => {
      const third = feel(x, 20, 'hop')[2]?.who;
      return third !== undefined && feel(x, 20, 'bite').some((b) => b.who === third);
    },
    "tap 3's pixels in the air",
  );
  await page.evaluate(() => window.__munchDebug?.pause?.(true));
  const frozen = await now(page);
  await page.waitForTimeout(1000);
  const still = await now(page);
  expect(still.clock).toBe(frozen.clock);
  expect(still.motion).toBeCloseTo(frozen.motion, 6);
  expect(still.pool.active).toBe(frozen.pool.active);
  expect(still.shaking).toBe(false);
  const during = (await vibes()).length;
  await page.evaluate(() => window.__munchDebug?.pause?.(false));
  const done = await waitState(
    page,
    (x) => x.game?.pending === 0 && x.game.pool.active === 0 && x.game.timeScale === 1,
    'the stream played on',
  );
  expect(done.game?.mismatches).toEqual([]);
  // after the resume the hop's buzz was not replayed; the full meal buzzed once
  expect((await vibes()).slice(during)).toEqual([[12]]);
});

test('pools: a long level ends with the object count of its first tap', async ({ page }) => {
  const g0 = await open(page, 26);
  const sol = g0.solution;
  await playPaced(page, sol.slice(0, 1));
  const a = (
    await waitState(
      page,
      (x) => x.game?.pending === 0 && x.game.pool.active === 0 && x.game.timeScale === 1,
      'first tap settled',
    )
  ).game as Game;
  await playPaced(page, sol.slice(1));
  const z = (
    await waitState(
      page,
      (x) =>
        x.game?.panel === 'win' &&
        x.game.pool.active === 0 &&
        x.game.views === 0 &&
        x.game.timeScale === 1,
      'won, confetti down, every muncher gone',
    )
  ).game as Game;
  // hundreds of bites, dozens of meals: no pool grew, nothing else was created or left behind
  expect(feel((await state(page)) as MunchDebugState, 26, 'bite').length).toBeGreaterThan(100);
  expect(z.pool).toEqual({ ...a.pool, active: 0 });
  expect(z.pool.grown).toBe(0);
  expect(z.objects - z.views - z.panelObjects).toBe(a.objects - a.views - a.panelObjects);
});
