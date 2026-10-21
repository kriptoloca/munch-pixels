import Phaser from 'phaser';
import { EMPTY, parsePicture } from '../../core/board';
import { Game } from '../../core/game';
import {
  BEVEL_DARK,
  BEVEL_LIGHT,
  BOARD_PAD,
  BOARD_RADIUS,
  COLOR_BUTTON,
  COLOR_BUTTON_MARK,
  COLOR_PUFF,
  COLOR_SLOT,
  COLOR_SLOT_WAIT,
  LEVEL_FONT_PX,
  MINI_SCALE,
  PANEL_BUTTON_R,
  PANEL_DIM,
  SLOT_RADIUS,
  SLOT_STROKE,
  TILE_PX,
} from '../../config';
import { levelFor } from '../../data/levels';
import { COLOR_BOARD, PALETTE, colourOf } from '../../data/palette';
import { uninstallDebug } from '../../dev/debug';
import type { GameProbe } from '../../dev/game-debug';
import { drawFace, type FacePicture } from '../../gen/face';
import { OUTLINE_KEY } from '../../gen/params';
import type { Level } from '../../gen/level';
import { track } from '../../platform/analytics';
import { getPlatform, markInteractive } from '../../platform/bridge';
import { haptic, setHapticsEnabled, type HapticKind } from '../../platform/haptics';
import { NO_SFX_OPTIONS, audio, sfxGain, type SfxOptions } from '../audio';
import type { SfxName } from '../audio-keys';
import {
  BITE_FLIGHT_MS,
  FAST_FLIGHT_MS,
  FEEL_SLOW_MAX,
  FULL_BOUNCE_MS,
  FULL_BOUNCE_SCALE,
  FULL_HIT_STOP_MS,
  FULL_LAST_BITE_DB,
  FULL_SHAKE_MS,
  HOP_ARC_SHARE,
  HOP_MS,
  HOP_SQUASH_MS,
  HOP_SQUASH_X,
  HOP_SQUASH_Y,
  LAG_LIMIT_MS,
  LAG_SKIP_MS,
  LEAVE_MS,
  LEAVE_RISE_SHARE,
  LEVEL_START_GUARD_MS,
  NOPE_BOB_PX,
  NOPE_SHAKE_MS,
  NOPE_SHAKE_PX,
  PANEL_GUARD_MS,
  PANEL_SLIDE_MS,
  QUEUE_REVEAL_MS,
  WADDLE_ANGLE,
  WADDLE_SWINGS,
  WAKE_JUMP_PX,
  WAKE_MS,
  WIN_BLINK_MS,
  WIN_FACE_SCALE,
  WIN_GROW_MS,
  WIN_HIT_STOP_MS,
  WIN_SHAKE_INTENSITY,
  WIN_SHAKE_MS,
  ComboCounter,
  SoundFrameGate,
  biteDetune,
  hopDetune,
  kickIntensity,
  type FeelEvent,
} from '../feel';
import { Fx, type Piece } from '../fx';
import { drawPlay, drawRetry } from '../glyphs';
import {
  computeLayout,
  denPoint,
  pickDen,
  winScale,
  type DenHit,
  type GameLayout,
  type Point,
} from '../layout';
import { chipFontPx, mixColour } from '../muncher-art';
import { MuncherView, type Place } from '../muncher-view';
import { ResumeGrace, bindPauseGrace } from '../resume-grace';
import { persistProgress, progress } from '../state';
import { ensureMuncherTextures } from '../textures';
import { Timeline, muncherId, type Action } from '../timeline';

const SNACK_KEY = 'snack';
/** Draw order: the board above the panels' dim (the face and the snack stay bright), then the
 * slots and seated munchers lifted above it by `showPanel`, the button on top. */
const DEPTH_BOARD = 45;
const DEPTH_FLIGHT = 46;
const DEPTH_DIM = 40;
const DEPTH_PANEL = 50;
/** The button mark is drawn at this share of the button radius. */
const MARK_SHARE = 0.45;
/** Palette order: a colour's hop pitch (D3). */
const PALETTE_KEYS = Object.keys(PALETTE);
/** Dev feel log: newest last, at most this many (a whole level of bites fits). */
const FEEL_LOG_SIZE = 1000;

/** One den on screen: views for the visible places, front first, and the "+N" chip. */
interface Den {
  views: MuncherView[];
  /** Rules index (in the lane) of `views[0]`: how many hops of this lane have played. */
  front: number;
  more: Phaser.GameObjects.Text;
}

/**
 * Game (GDD §2, §9 screen 3): the snack drawn into one canvas texture, the slot row, the dens,
 * taps, the rules resolving at once and the Timeline playing them back with the Feel spec's juice
 * (GDD §3a, Epic 4: hops, bite streams, full meals with hit stop and kick, chains, nope, the win
 * reveal, the stuck beat; pooled effects on the scene clock), the win and lose panels, progress.
 */
export class GameScene extends Phaser.Scene {
  private readonly grace = new ResumeGrace(this);
  private level!: Level;
  /** The rules of the level being played. */
  private rules!: Game;
  private colours: number[] = [];
  /** The snack as drawn at the start (the rules' board only knows what is eaten now). */
  private original!: Int8Array;
  /** The face drawn under the snack: the hidden face, at the win its blink, then its grin (D6). */
  private face!: FacePicture;
  private faces!: { base: FacePicture; blink: FacePicture; smile: FacePicture };
  private blinks = 0;
  /** The board panel and the snack image, centred so the win can grow them with a bounce. */
  private boardPanel: Phaser.GameObjects.Rectangle | null = null;
  private snackImage: Phaser.GameObjects.Image | null = null;
  private snackScale = { x: 1, y: 1 };
  private readonly boardGrow = { k: 1 };
  /** The scale the win grows the board to on this screen (`winScale`, set by `render`). */
  private winK = WIN_FACE_SCALE;
  /** The confetti's colours: the level's fills without the outline ink. */
  private confettiColours: number[] = [];
  /** Cells where the face shows (a bite played there, or the win revealed it all). */
  private revealed!: Uint8Array;
  private cols = 0;
  private rows = 0;
  private layout!: GameLayout;
  /** The design size the screen was last drawn for (a RESIZE to the same size draws nothing). */
  private drawnFor = { width: 0, height: 0 };
  private texture: Phaser.Textures.CanvasTexture | null = null;
  private boardDirty = false;
  private timeline = new Timeline();
  /** Scene time in ms; it only runs while the game is not paused. */
  private clock = 0;
  private paused = false;
  private slotFrames: Phaser.GameObjects.Rectangle[] = [];
  /** Munchers out of their dens (seated or still leaving), by `muncherId`. */
  private readonly out = new Map<string, MuncherView>();
  private dens: Den[] = [];
  /** Pooled flights, crumbs, puffs and confetti on the scene clock. */
  private fx!: Fx;
  /** Scratch points of the bite path: where a pixel lifts from and the mouth it flies to. */
  private readonly biteFrom: Point = { x: 0, y: 0 };
  private readonly biteTo: Point = { x: 0, y: 0 };
  /** A full muncher still leaving each slot (a new hop into the slot hurries it off). */
  private leaving: (MuncherView | null)[] = [];
  /**
   * Finishes in a row (GDD §3a combo), fed by the full and wait actions in `apply`, so a redraw
   * that flushes them still counts them; `fullStep` is the step of the full being played.
   */
  private readonly combo = new ComboCounter();
  private fullStep = 0;
  private panel: 'win' | 'lose' | null = null;
  /** Scene time when the panel opened. */
  private panelAt = 0;
  private panelButton: Point | null = null;
  /** Objects the open panel added (the dev object count). */
  private panelObjects = 0;
  /** The stuck beat began (a lost level): seated munchers look down, also after a redraw. */
  private stuck = false;
  /** A resize that came during a pause, drawn on resume (nothing plays under a pause). */
  private resizePending = false;
  private pressed: DenHit = null;
  /** A press that began on the open panel (a press from before it opened never counts). */
  private panelPressed = false;
  private nopes = 0;
  /**
   * The scene clock and the tweens run at this rate: 1 / feelslow, and 0 inside a hit stop
   * (`hitStop`). A pause stops both on top of it, so a restored rate never resumes a pause.
   */
  private clockScale = 1;
  /** Dev `?feelslow=K` (D15): every feel timing K times longer. */
  private feelSlow = 1;
  /** Frames played (D4: a squeezed action plays at most one sound of a kind per frame). */
  private frame = 0;
  private readonly soundGate = new SoundFrameGate<SfxName>();
  /** The wall-clock timer that ends the running hit stop. */
  private hitStopTimer: number | null = null;
  /** Dev counters and the feel log (kept across levels; `level` tells them apart). */
  private hitStops = 0;
  private shakeStarts = 0;
  private readonly feelLog: FeelEvent[] = [];
  /** Created once: `update` hands it to the timeline every frame without allocating. */
  private readonly playAction = (a: Action): void => {
    this.play(a);
  };
  /** Created once: a bitten pixel reached its mouth (the digit drops, the tick sounds). */
  private readonly onLand = (p: Piece): void => {
    this.out.get(p.who)?.eat(this.clock);
    const sound = this.landSound;
    sound.detune = p.detune;
    sound.db = p.last ? FULL_LAST_BITE_DB : 0;
    this.sfx('bite', p.fast, sound);
  };
  /** The landing tick's options, rewritten per bite (14 a second: no object per pixel). */
  private readonly landSound: SfxOptions = { detune: 0, db: 0 };
  /** Created once: advances each muncher's gulp every frame without allocating. */
  private readonly tickView = (v: MuncherView): void => {
    v.tick(this.clock);
  };

  constructor() {
    super('Game');
  }

  /** `level` replays that level (retry); without it the saved progress decides (next, Title). */
  create(data: { level?: number } = {}): void {
    this.level = levelFor(data.level ?? progress.level);
    this.rules = new Game(this.level);
    this.colours = this.rules.keys.map(colourOf);
    const { board } = parsePicture(this.level.rows);
    this.cols = board.w;
    this.rows = board.h;
    this.original = board.cells.slice();
    const seed = this.level.face;
    this.faces = {
      base: drawFace(seed, this.cols, this.rows),
      blink: drawFace(seed, this.cols, this.rows, { eyesClosed: true, mouth: 'grin' }),
      smile: drawFace(seed, this.cols, this.rows, { mouth: 'grin' }),
    };
    this.face = this.faces.base;
    this.blinks = 0;
    this.boardGrow.k = 1;
    this.confettiColours = this.colours.filter((_, i) => this.rules.keys[i] !== OUTLINE_KEY);
    if (this.confettiColours.length === 0) this.confettiColours = [COLOR_BUTTON];
    this.revealed = new Uint8Array(board.cells.length);
    this.timeline = new Timeline();
    this.clock = 0;
    this.panel = null;
    this.panelAt = 0;
    this.stuck = false;
    this.resizePending = false;
    this.pressed = null;
    this.panelPressed = false;
    this.nopes = 0;
    this.frame = 0;
    this.soundGate.reset();
    this.combo.reset();
    this.fullStep = 0;
    this.fx = new Fx(this, DEPTH_FLIGHT, this.onLand);
    if (import.meta.env.DEV) {
      // Dev builds only: `?feelslow=K` (D15) stretches every feel timing K times.
      const slow = Number(new URLSearchParams(window.location.search).get('feelslow'));
      this.feelSlow = Number.isFinite(slow) && slow >= 1 ? Math.min(FEEL_SLOW_MAX, slow) : 1;
    }
    // A restarted scene keeps its tween manager: no stop left over, the feel rate again.
    this.endHitStop();
    this.tweens.setLagSmooth(LAG_LIMIT_MS, LAG_SKIP_MS);
    // Boot draws them; a boot that failed half-way still gets its munchers here.
    ensureMuncherTextures(this);
    this.createTexture();
    this.render();

    const platform = getPlatform();
    const unsubscribe = bindPauseGrace(this.grace, platform);
    const unsubscribeFreeze = platform.onPause((p) => {
      this.setPaused(p);
    });
    this.setPaused(platform.isPaused());
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      this.onDown(p);
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      this.onUp(p);
    });
    const onResize = (): void => {
      this.onResize();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.endHitStop();
      unsubscribe();
      unsubscribeFreeze();
      this.grace.dispose();
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      if (this.textures.exists(SNACK_KEY)) this.textures.remove(SNACK_KEY);
      this.texture = null;
      if (import.meta.env.DEV) uninstallDebug();
    });
    track('level_start', { level: this.level.id });
    // Only the dev `?level=` shortcut reaches the Game before the Title; then this is the first
    // interactive screen.
    markInteractive(platform);
    if (import.meta.env.DEV) {
      this.cameras.main.on(Phaser.Cameras.Scene2D.Events.SHAKE_START, () => {
        this.shakeStarts += 1;
      });
      // Dev builds only: the probe and the hooks' module are dropped from production.
      const probe: GameProbe = {
        level: () => this.level,
        rules: () => this.rules,
        layout: () => this.layout,
        canvas: () => this.game.canvas,
        pending: () => this.timeline.pending,
        panel: () => this.panel,
        panelButton: () => this.panelButton,
        nopes: () => this.nopes,
        outViews: () => this.out.size,
        denViews: () => this.dens.reduce((n, d) => n + d.views.length, 0),
        shown: (lane) => this.dens[lane]?.views.length ?? 0,
        motion: () => {
          let sum = this.children.list.reduce((acc, c) => {
            const o = c as Phaser.GameObjects.Container;
            return acc + o.x + o.y + o.alpha + o.scaleX + o.rotation;
          }, 0);
          for (const v of this.allViews()) sum += v.motion;
          return sum;
        },
        inputOpen: () => !this.paused && this.panel === null && this.clock >= LEVEL_START_GUARD_MS,
        panelReady: () => this.panel !== null && this.clock - this.panelAt >= PANEL_GUARD_MS,
        panelAt: () => this.panelAt,
        faded: () =>
          this.dens.reduce(
            (n, d) => n + d.views.filter((v) => !v.box.visible || v.box.alpha < 1).length,
            0,
          ),
        screen: () => ({
          seats: this.rules.slots.map((s) => {
            const v = s ? this.out.get(muncherId(s.lane, s.index)) : undefined;
            return v
              ? {
                  digit: v.digit,
                  alpha: v.box.visible ? v.box.alpha : 0,
                  x: v.box.x,
                  y: v.box.y,
                  face: v.expression,
                }
              : null;
          }),
          amber: this.slotFrames.map((f) => f.strokeColor === COLOR_SLOT_WAIT),
          dens: this.dens.map((d) => ({
            front: d.front,
            digits: d.views.map((v) => v.digit),
            alphas: d.views.map((v) => (v.box.visible ? v.box.alpha : 0)),
            more: d.more.visible ? d.more.text : '',
          })),
        }),
        feel: () => this.feelLog,
        timeScale: () => this.tweens.timeScale,
        hitStops: () => this.hitStops,
        shakeStarts: () => this.shakeStarts,
        shaking: () => this.cameras.main.shakeEffect.isRunning,
        clock: () => this.clock,
        pool: () => this.fx.counts(),
        objects: () => this.children.length,
        views: () => this.allViews().length,
        panelObjects: () => (this.panel ? this.panelObjects : 0),
        blinks: () => this.blinks,
        smile: () => this.panel === 'win' && this.face === this.faces.smile,
        boardScale: () => this.boardGrow.k,
        winScale: () => this.winK,
        hitStop: (ms) => {
          this.hitStop(ms);
        },
      };
      void import('../../dev/game-debug').then((m) => {
        if (this.scene.isActive()) m.installGameDebug(probe);
      });
    }
  }

  override update(_time: number, delta: number): void {
    if (this.paused) return;
    this.frame += 1;
    // The same stall rule as the tweens (setLagSmooth), so flights and bites stay in step; the
    // clock scale is 0 inside a hit stop and 1 / feelslow otherwise.
    this.clock += (delta > LAG_LIMIT_MS ? LAG_SKIP_MS : delta) * this.clockScale;
    this.timeline.drain(this.clock, this.playAction);
    this.fx.update(this.clock);
    this.out.forEach(this.tickView);
    if (this.boardDirty && this.texture) {
      this.texture.refresh();
      this.boardDirty = false;
    }
  }

  // ---- input --------------------------------------------------------------------------------

  private onDown(p: Phaser.Input.Pointer): void {
    // A gesture: the music may start (the Title's play tap already did, unless a dev URL went
    // straight to the Game).
    audio.startMusic();
    // Short guards at level start and when a panel opens: the second tap of a double tap never
    // skips the reveal or sends the next level's first muncher (audit 2026-10-19).
    const open = this.clock >= LEVEL_START_GUARD_MS;
    this.pressed = this.panel || !open ? null : this.hit(p.x, p.y);
    this.panelPressed =
      this.panel !== null && this.clock - this.panelAt >= PANEL_GUARD_MS && this.onPanelButton(p);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.panel) {
      const pressed = this.panelPressed;
      this.panelPressed = false;
      if (!pressed || !this.onPanelButton(p)) return;
      // Retry replays this level whatever the save says by now (a late save read may have moved
      // it, audit 2026-10-19); next follows the saved progress.
      this.scene.restart(this.panel === 'lose' ? { level: this.level.id } : {});
      return;
    }
    const down = this.pressed;
    this.pressed = null;
    const up = this.hit(p.x, p.y);
    if (!down || !up || down.kind !== up.kind || down.lane !== up.lane || down.k !== up.k) return;
    if (up.kind === 'front') this.tapLane(up.lane);
    else this.nope(up.lane, up.k);
  }

  /** The den place under a point (`pickDen`: fronts first, then the queue). */
  private hit(x: number, y: number): DenHit {
    return pickDen(
      this.layout,
      this.dens.map((d) => d.views.length),
      x,
      y,
    );
  }

  private tapLane(lane: number): void {
    const { result, events } = this.rules.tap(lane);
    if (result !== 'ok') return;
    this.timeline.add(events, this.clock);
    if (this.rules.status === 'won') this.onWonByRules();
    else if (this.rules.status === 'lost') track('level_fail', { level: this.level.id });
  }

  /** The rules say won: the progress is saved at once, the panel waits for the reveal. */
  private onWonByRules(): void {
    const id = this.level.id;
    progress.level = Math.min(Math.max(progress.level, id + 1), this.maxLevel());
    progress.levelsCompleted += 1;
    if (!progress.facesFound.includes(id)) progress.facesFound.push(id);
    persistProgress();
    track('level_complete', { level: id, taps: this.rules.taps });
  }

  private maxLevel(): number {
    // levelFor clamps; the save keeps the last level once the list is done (v0.1).
    return levelFor(Number.MAX_SAFE_INTEGER).id;
  }

  /**
   * A tap on a muncher behind the front (GDD §3a): failure stays local and soft. It shakes its
   * head ±6 px (two 40 ms swings), the front of its lane bobs once (the one to tap), a quiet
   * `nope` and the shortest haptic; no kick, no hit stop.
   */
  private nope(lane: number, k: number): void {
    this.nopes += 1;
    const den = this.dens[lane];
    const view = den?.views[k];
    if (view) {
      const at = denPoint(this.layout, lane, k);
      this.stopMotion(view);
      view.box.setPosition(at.x, at.y).setScale(MINI_SCALE).setAlpha(1);
      this.tweens.add({
        targets: view.box,
        x: { from: at.x - NOPE_SHAKE_PX, to: at.x + NOPE_SHAKE_PX },
        duration: NOPE_SHAKE_MS,
        yoyo: true,
        onComplete: () => {
          view.box.setX(at.x);
        },
      });
    }
    const front = den?.views[0];
    if (front) this.bounce(front, denPoint(this.layout, lane, 0), NOPE_BOB_PX);
    const gain = this.sfx('nope', false);
    const buzz = this.buzz('nope', false);
    if (import.meta.env.DEV) {
      this.logFeel({
        kind: 'nope',
        who: `${String(lane)}:${String((den?.front ?? 0) + k)}`,
        gain,
        haptic: buzz,
        shake: 0,
        hitStop: 0,
        jump: front ? NOPE_BOB_PX : 0,
      });
    }
  }

  /** The win panel takes a tap anywhere (GDD §9); the lose panel only on its retry button. */
  private onPanelButton(p: Phaser.Input.Pointer): boolean {
    if (this.panel === 'win') return true;
    const b = this.panelButton;
    return b !== null && Math.hypot(p.x - b.x, p.y - b.y) <= PANEL_BUTTON_R;
  }

  // ---- playback -----------------------------------------------------------------------------

  /** One timeline action: the state it changes, then its animation. */
  private play(a: Action): void {
    this.apply(a);
    this.animate(a);
  }

  /** The part of an action the screen keeps (also used when the timeline is flushed). */
  private apply(a: Action): void {
    switch (a.kind) {
      case 'bite':
        this.revealed[a.cell] = 1;
        this.drawCell(a.cell);
        break;
      case 'full':
        this.fullStep = this.combo.full();
        break;
      case 'wait':
        this.combo.wait();
        break;
      case 'won':
        // the state of the win: the whole face, grinning, the board grown (the reveal animates
        // to it; a redraw lands on it)
        this.revealed.fill(1);
        this.face = this.faces.smile;
        this.boardGrow.k = this.winK;
        this.drawBoard();
        this.panel = 'win';
        this.panelAt = this.clock;
        break;
      case 'stuck':
        this.stuck = true;
        break;
      case 'lost':
        this.panel = 'lose';
        this.panelAt = this.clock;
        break;
      default:
        break;
    }
  }

  private animate(a: Action): void {
    switch (a.kind) {
      case 'hop':
        this.animateHop(a);
        break;
      case 'bite':
        this.animateBite(a);
        break;
      case 'full':
        this.animateFull(a);
        break;
      case 'wait':
        this.animateWait(a);
        break;
      case 'wake':
        this.animateWake(a);
        break;
      case 'won':
        this.winReveal(a);
        this.showPanel();
        break;
      case 'stuck':
        this.stuckBeat(a);
        break;
      case 'lost':
        this.showPanel();
        break;
    }
  }

  /** A jump up and back at `at` (the resting place, never a position caught mid-tween). */
  private bounce(view: MuncherView, at: Point, height: number): void {
    this.stopMotion(view);
    view.box.setPosition(at.x, at.y).setScale(1).setAlpha(1);
    this.tweens.add({
      targets: view.anim,
      lift: height,
      duration: WAKE_MS / 2,
      yoyo: true,
      ease: 'Quad.easeOut',
      onUpdate: view.applyAnim,
    });
  }

  /**
   * Hit stop (GDD §3a; the one function of the Epic 4 risk note): the scene clock and the tweens
   * stand still for `ms` (× feelslow), restored on the wall clock. Never started under a pause,
   * and a pause inside it stays frozen after the restore: the pause has its own switches
   * (`paused` in update, tweens.pauseAll), the stop only zeroes the rates.
   */
  private hitStop(ms: number): void {
    if (ms <= 0 || this.paused) return;
    this.hitStops += 1;
    this.clockScale = 0;
    this.tweens.timeScale = 0;
    if (this.hitStopTimer !== null) window.clearTimeout(this.hitStopTimer);
    this.hitStopTimer = window.setTimeout(this.endHitStop, ms * this.feelSlow);
  }

  /** Ends a hit stop (or none): the feel rate again. Created once (the timer's callback). */
  private readonly endHitStop = (): void => {
    if (this.hitStopTimer !== null) window.clearTimeout(this.hitStopTimer);
    this.hitStopTimer = null;
    this.clockScale = 1 / this.feelSlow;
    this.tweens.timeScale = this.clockScale;
  };

  /** A camera kick; `force` restarts a running one at the new strength (a fast combo). */
  private kick(ms: number, intensity: number): void {
    this.cameras.main.shake(ms * this.feelSlow, intensity, true);
  }

  /** Stops every motion of a muncher and puts it at rest where it stands. */
  private stopMotion(view: MuncherView): void {
    this.tweens.killTweensOf(view.box);
    this.tweens.killTweensOf(view.anim);
    view.rest();
  }

  /** Every muncher view alive (seated, leaving, in the dens). */
  private allViews(): MuncherView[] {
    const all = [...this.out.values()];
    for (const d of this.dens) all.push(...d.views);
    return all;
  }

  /**
   * Plays a sound effect and returns its gain (the feel log). A squeezed action plays at most
   * one sound of a kind per frame (D4), so a burst of fast bites is one tick, not a roar.
   */
  private sfx(name: SfxName, fast: boolean, opts: Readonly<SfxOptions> = NO_SFX_OPTIONS): number {
    if (fast && !this.soundGate.take(name, this.frame)) return 0;
    audio.play(name, opts);
    return sfxGain(name, opts.db ?? 0);
  }

  /** A haptic for an unsqueezed action (D4: none for a squeezed one); returns what it asked. */
  private buzz(kind: HapticKind, fast: boolean): HapticKind | null {
    if (fast) return null;
    haptic(kind);
    return kind;
  }

  /** Dev builds: one moment of feel for the e2e, the capture and the gamer. */
  private logFeel(e: Omit<FeelEvent, 't' | 'wall' | 'level'>): void {
    this.feelLog.push({ ...e, t: this.clock, wall: performance.now(), level: this.level.id });
    if (this.feelLog.length > FEEL_LOG_SIZE) this.feelLog.shift();
  }

  /**
   * Tap a front muncher (GDD §3a): it squashes as it takes off, hops on an arc into its slot and
   * squashes again as it lands; the hop sounds at its colour's pitch (D3). A squeezed hop just
   * flies (D4: no haptic).
   */
  private animateHop(a: Action & { kind: 'hop' }): void {
    const { who, lane, slot, fast } = a;
    const den = this.dens[lane];
    const view = den?.views.shift();
    if (!den || !view) return;
    den.front += 1;
    this.out.set(who, view);
    const old = this.leaving[slot];
    if (old) this.hurryOff(old, slot);
    const to = this.layout.slots[slot] as Point;
    const ms = fast ? FAST_FLIGHT_MS : HOP_MS;
    // A killed fade-in never leaves a muncher faded: whatever moves is fully drawn at once
    // (a tween reads its start value on its first update, so a fade killed every frame by
    // fast taps would never progress; audit 2026-10-19).
    this.stopMotion(view);
    view.box.setAlpha(1);
    view.setPlace('seat');
    view.setFace('idle');
    if (fast) {
      this.tweens.add({
        targets: view.box,
        x: to.x,
        y: to.y,
        scale: 1,
        duration: ms,
        ease: 'Quad.easeOut',
      });
    } else {
      this.hopArc(view, to);
    }
    den.views.forEach((v, k) => {
      const p = denPoint(this.layout, lane, k);
      this.stopMotion(v);
      v.box.setAlpha(1);
      v.setPlace(k === 0 ? 'front' : 'queue');
      this.tweens.add({
        targets: v.box,
        x: p.x,
        y: p.y,
        scale: k === 0 ? 1 : MINI_SCALE,
        duration: ms,
      });
    });
    this.fillDen(lane, true);
    const m = this.rules.lanes[lane]?.[a.index];
    const key = m ? (this.rules.keys[m.colour] ?? '') : '';
    const detune = hopDetune(PALETTE_KEYS.indexOf(key));
    const gain = this.sfx('hop', fast, { detune });
    const buzz = this.buzz('hop', fast);
    if (import.meta.env.DEV)
      this.logFeel({ kind: 'hop', at: a.at, who, slot, detune, gain, haptic: buzz, fast });
  }

  /** The hop's arc: take-off squash relaxing over HOP_SQUASH_MS, a parabola, a land squash. */
  private hopArc(view: MuncherView, to: Point): void {
    const x0 = view.box.x;
    const y0 = view.box.y;
    const s0 = view.box.scaleX;
    const peak = HOP_ARC_SHARE * this.layout.slotSize;
    const squashPart = HOP_SQUASH_MS / HOP_MS;
    const anim = view.anim;
    anim.t = 0;
    this.tweens.add({
      targets: anim,
      t: 1,
      duration: HOP_MS,
      onUpdate: () => {
        const t = anim.t;
        const e = 1 - (1 - t) * (1 - t);
        view.box
          .setPosition(x0 + (to.x - x0) * e, y0 + (to.y - y0) * e)
          .setScale(s0 + (1 - s0) * e);
        anim.lift = 4 * peak * t * (1 - t);
        const q = Math.max(0, 1 - t / squashPart);
        anim.sx = 1 + (HOP_SQUASH_X - 1) * q;
        anim.sy = 1 + (HOP_SQUASH_Y - 1) * q;
        view.applyAnim();
      },
      onComplete: () => {
        view.box.setPosition(to.x, to.y).setScale(1);
        anim.lift = 0;
        anim.sx = HOP_SQUASH_X;
        anim.sy = HOP_SQUASH_Y;
        view.applyAnim();
        this.tweens.add({
          targets: anim,
          sx: 1,
          sy: 1,
          duration: HOP_SQUASH_MS,
          ease: 'Quad.easeOut',
          onUpdate: view.applyAnim,
        });
      },
    });
  }

  /**
   * Each bite (GDD §3a): the pixel lifts, flies on an arc into the mouth and shrinks; three crumbs
   * in its colour burst where it stood. The digit drops, the belly swells and the tick sounds
   * when it lands (`onLand`), 100 cents higher per bite of the meal on the meal's combo base (D1,
   * D2). The flight starts at its scheduled time, so it lands on the frame its full meal plays.
   */
  private animateBite(a: Action & { kind: 'bite' }): void {
    const view = this.out.get(a.who);
    const from = this.cellCentre(a.cell, this.biteFrom);
    const colour = this.colours[this.original[a.cell] as number] ?? COLOR_BOARD;
    if (view && !view.eating) {
      // A new eating run (after the hop or a wake) takes the combo step of this moment.
      view.eating = true;
      view.runStep = this.combo.step;
      view.setFace('eating');
    }
    const step = view ? view.runStep : this.combo.step;
    const detune = biteDetune(a.n, step);
    const to = view ? view.mouth(this.biteTo) : (this.layout.slots[a.slot] as Point);
    const ms = a.fast ? FAST_FLIGHT_MS : BITE_FLIGHT_MS;
    this.fx.flight(from, to, colour, this.layout.cell, a.at, ms, a.who, a.last, a.fast, detune);
    this.fx.crumbs(from, colour, this.layout.cell, a.at);
    if (import.meta.env.DEV) {
      const gain = sfxGain('bite', a.last ? FULL_LAST_BITE_DB : 0);
      this.logFeel({
        kind: 'bite',
        at: a.at,
        who: a.who,
        slot: a.slot,
        n: a.n,
        detune,
        step,
        gain,
        fast: a.fast,
      });
    }
  }

  /**
   * The last bite (GDD §3a): its pixel lands (the tick 2 dB louder), the combo steps up, a 45 ms
   * hit stop and a kick that grows with the step; then the belly bounces, the face turns smug,
   * it burps a puff and waddles off. A squeezed full only burps and goes (D4).
   */
  private animateFull(a: Action & { kind: 'full' }): void {
    // Its last pixel lands now, on this frame (the flight was scheduled to land exactly here).
    this.fx.land(a.who);
    const view = this.out.get(a.who);
    this.out.delete(a.who);
    this.slotFrames[a.slot]?.setStrokeStyle(SLOT_STROKE, COLOR_BOARD);
    const step = this.fullStep;
    let shake = 0;
    let stop = 0;
    if (!a.fast) {
      stop = FULL_HIT_STOP_MS;
      this.hitStop(stop);
      shake = kickIntensity(step);
      this.kick(FULL_SHAKE_MS, shake);
    }
    const buzz = this.buzz('full', a.fast);
    if (view) this.leave(view, a.slot, a.fast);
    else this.sfx('burp', a.fast);
    if (import.meta.env.DEV) {
      const gain = sfxGain('burp');
      this.logFeel({
        kind: 'full',
        at: a.at,
        who: a.who,
        slot: a.slot,
        step,
        shake,
        hitStop: stop,
        gain,
        haptic: buzz,
        fast: a.fast,
      });
    }
  }

  /**
   * A muncher that cannot eat yet (GDD §3a): it sits with its mouth open, eyes up at the snack,
   * the slot turns amber, a soft `wait`; the combo run is over. Its pixels in the air land now.
   */
  private animateWait(a: Action & { kind: 'wait' }): void {
    this.fx.land(a.who);
    this.slotFrames[a.slot]?.setStrokeStyle(SLOT_STROKE, COLOR_SLOT_WAIT);
    const view = this.out.get(a.who);
    if (view) {
      view.eating = false;
      view.setFace('waiting');
    }
    const gain = this.sfx('wait', a.fast);
    if (import.meta.env.DEV) {
      this.logFeel({
        kind: 'wait',
        at: a.at,
        who: a.who,
        slot: a.slot,
        gain,
        shake: 0,
        haptic: null,
        fast: a.fast,
      });
    }
  }

  /** A waiting muncher wakes (a chain, GDD §3a): it jumps, eyes wide, `perk`, then eats. */
  private animateWake(a: Action & { kind: 'wake' }): void {
    this.slotFrames[a.slot]?.setStrokeStyle(SLOT_STROKE, COLOR_BOARD);
    const view = this.out.get(a.who);
    if (view) {
      view.eating = false;
      this.bounce(view, this.layout.slots[a.slot] as Point, WAKE_JUMP_PX);
      view.setFace('waking');
    }
    const gain = this.sfx('perk', a.fast);
    if (import.meta.env.DEV) {
      this.logFeel({
        kind: 'wake',
        at: a.at,
        who: a.who,
        slot: a.slot,
        gain,
        jump: WAKE_JUMP_PX,
        fast: a.fast,
      });
    }
  }

  /**
   * The last pixel (GDD §3a): after its own beat (the timeline put the win WIN_BEAT_MS after the
   * last landing), a 60 ms hit stop and the biggest kick; the face blinks once and grins (D6), the
   * board grows with a bounce (1.08×, less where that would reach a neighbour: `winScale`),
   * confetti in the level's colours, the jingle, the 20-40-40 ms haptic. The panel is the caller's: `animate` opens it, a redraw (a resize inside the beat)
   * draws it before the reveal plays.
   */
  private winReveal(a: Action & { kind: 'won' }): void {
    this.hitStop(WIN_HIT_STOP_MS);
    this.kick(WIN_SHAKE_MS, WIN_SHAKE_INTENSITY);
    const buzz = this.buzz('won', false);
    const gain = this.sfx('win', false);
    this.blinks += 1;
    this.face = this.faces.blink;
    this.drawBoard();
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: WIN_BLINK_MS,
      onComplete: () => {
        this.face = this.faces.smile;
        this.drawBoard();
      },
    });
    this.boardGrow.k = 1;
    this.applyBoardScale();
    this.tweens.add({
      targets: this.boardGrow,
      k: this.winK,
      duration: WIN_GROW_MS,
      ease: 'Back.easeOut',
      onUpdate: this.applyBoardScale,
    });
    this.fx.confetti(this.layout.snack, this.confettiColours, this.clock);
    if (import.meta.env.DEV) {
      this.logFeel({
        kind: 'win',
        at: a.at,
        hitStop: WIN_HIT_STOP_MS,
        shake: WIN_SHAKE_INTENSITY,
        gain,
        haptic: buzz,
      });
    }
  }

  /**
   * Stuck (GDD §3a): failure stays soft. The timeline turns the waiting munchers' faces down one
   * by one, slot by slot, 80 ms apart; the first turn plays one `stuck` at its gain and a 30 ms
   * haptic; no kick, no hit stop. The lose panel slides in STUCK_MS after the first turn.
   */
  private stuckBeat(a: Action & { kind: 'stuck' }): void {
    this.out.get(a.who)?.setFace('stuck');
    const beat = a.k === 0;
    const gain = beat ? this.sfx('stuck', a.fast) : 0;
    const buzz = beat ? this.buzz('stuck', a.fast) : null;
    if (import.meta.env.DEV) {
      this.logFeel({
        kind: 'stuck',
        at: a.at,
        who: a.who,
        slot: a.slot,
        n: a.k,
        gain,
        haptic: buzz,
        shake: 0,
        hitStop: 0,
      });
    }
  }

  /** The board panel and the snack follow `boardGrow` (created once: a tween's onUpdate). */
  private readonly applyBoardScale = (): void => {
    const k = this.boardGrow.k;
    this.boardPanel?.setScale(k);
    this.snackImage?.setScale(this.snackScale.x * k, this.snackScale.y * k);
  };

  /** A full muncher leaves its slot: bounce, burp and puff, then the waddle off. */
  private leave(view: MuncherView, slot: number, fast: boolean): void {
    const at = this.layout.slots[slot] as Point;
    this.stopMotion(view);
    view.box.setPosition(at.x, at.y).setScale(1).setAlpha(1);
    view.setFace('full');
    view.eating = false;
    this.leaving[slot] = view;
    if (fast) {
      this.sfx('burp', true);
      this.hurryOff(view, slot);
      return;
    }
    // The burp and its puff come at the top of the bounce on a timer of their own: a next tap
    // that hurries this muncher off (its slot taken) must not cut them.
    const mouth = view.mouth({ x: 0, y: 0 });
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: FULL_BOUNCE_MS / 2,
      onComplete: () => {
        this.sfx('burp', false);
        this.fx.puff(mouth, COLOR_PUFF, this.layout.muncherSize, this.clock);
      },
    });
    this.tweens.add({
      targets: view.anim,
      sx: FULL_BOUNCE_SCALE,
      sy: FULL_BOUNCE_SCALE,
      duration: FULL_BOUNCE_MS / 2,
      yoyo: true,
      ease: 'Quad.easeOut',
      onUpdate: view.applyAnim,
      onComplete: () => {
        this.waddleOff(view, slot, at);
      },
    });
  }

  /** It rises out of the slot rocking side to side and fades (LEAVE_MS). */
  private waddleOff(view: MuncherView, slot: number, at: Point): void {
    const rise = LEAVE_RISE_SHARE * this.layout.slotSize;
    const anim = view.anim;
    anim.t = 0;
    this.tweens.add({
      targets: anim,
      t: 1,
      duration: LEAVE_MS,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        const t = anim.t;
        view.box
          .setPosition(at.x, at.y - rise * t)
          .setAlpha(1 - t)
          .setRotation(WADDLE_ANGLE * Math.sin(2 * Math.PI * WADDLE_SWINGS * t));
      },
      onComplete: () => {
        this.gone(view, slot);
      },
    });
  }

  /** A leaving muncher gets out of the way at once (a squeezed full, or a new hop into its slot). */
  private hurryOff(view: MuncherView, slot: number): void {
    this.stopMotion(view);
    const rise = LEAVE_RISE_SHARE * this.layout.slotSize;
    this.tweens.add({
      targets: view.box,
      y: view.box.y - rise,
      alpha: 0,
      duration: FAST_FLIGHT_MS,
      onComplete: () => {
        this.gone(view, slot);
      },
    });
  }

  private gone(view: MuncherView, slot: number): void {
    if (this.leaving[slot] === view) this.leaving[slot] = null;
    view.destroy();
  }

  // ---- drawing ------------------------------------------------------------------------------

  private onResize(): void {
    const { width, height } = this.scale.gameSize;
    if (width === this.drawnFor.width && height === this.drawnFor.height) return;
    if (this.paused) {
      this.resizePending = true;
      return;
    }
    // Play out whatever is pending (state only), then draw everything again at the new size. A
    // win still inside its beat gets its reveal on the new screen (render drew its panel).
    let won = null as (Action & { kind: 'won' }) | null;
    this.timeline.flush((a) => {
      this.apply(a);
      if (a.kind === 'won') won = a;
    });
    this.render();
    if (won) this.winReveal(won);
  }

  /** Draws the whole screen from the rules' state and the revealed cells. */
  private render(): void {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.fx.reset();
    this.leaving = [];
    this.out.clear();
    const { width, height } = this.scale.gameSize;
    this.drawnFor = { width, height };
    this.layout = computeLayout(width, height, {
      cols: this.cols,
      rows: this.rows,
      slots: this.rules.slots.length,
      lanes: this.rules.lanes.length,
    });
    const L = this.layout;
    this.winK = winScale(L, WIN_FACE_SCALE);
    this.add
      .text(L.level.x, L.level.y, String(this.level.id), {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${String(LEVEL_FONT_PX)}px`,
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5);
    const cx = L.snack.x + L.snack.w / 2;
    const cy = L.snack.y + L.snack.h / 2;
    this.boardPanel = this.add
      .rectangle(cx, cy, L.snack.w + 2 * BOARD_PAD, L.snack.h + 2 * BOARD_PAD, COLOR_BOARD)
      .setRounded(BOARD_RADIUS)
      .setDepth(DEPTH_BOARD - 1);
    this.snackImage = this.add
      .image(cx, cy, SNACK_KEY)
      .setDisplaySize(L.snack.w, L.snack.h)
      .setDepth(DEPTH_BOARD);
    this.snackScale = { x: this.snackImage.scaleX, y: this.snackImage.scaleY };
    if (this.panel === 'win') {
      // a redraw after the win lands on its end state (a tween cut by the redraw included)
      this.face = this.faces.smile;
      this.boardGrow.k = this.winK;
    }
    this.applyBoardScale();
    this.drawBoard();

    this.slotFrames = L.slots.map((p, i) => {
      const waiting = this.rules.slots[i]?.waiting === true;
      return this.add
        .rectangle(p.x, p.y, L.slotSize, L.slotSize, COLOR_SLOT)
        .setRounded(SLOT_RADIUS)
        .setStrokeStyle(SLOT_STROKE, waiting ? COLOR_SLOT_WAIT : COLOR_BOARD);
    });
    const seats = this.rules.slots.map((s, i) => {
      if (!s) return null;
      const who = muncherId(s.lane, s.index);
      const at = L.slots[i] as Point;
      const view = this.muncher(s.colour, s.remaining, at, 'seat', s.eaten);
      view.setFace(s.waiting ? (this.stuck ? 'stuck' : 'waiting') : 'eating');
      this.out.set(who, view);
      return who;
    });
    this.timeline.reset(seats);
    const moreFont = `${String(chipFontPx(L.miniSize))}px`;
    this.dens = this.rules.lanes.map((_, lane) => {
      const more = this.add
        .text(0, 0, '', {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: moreFont,
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5);
      return { views: [], front: this.rules.fronts[lane] as number, more };
    });
    this.dens.forEach((_, lane) => {
      this.fillDen(lane, false);
    });
    this.panelButton = null;
    if (this.panel) this.showPanel();
  }

  /**
   * Creates views for the den's free places (lazily: only what shows), and sets the "+N" chip
   * for munchers beyond the last place. `reveal` fades the newcomers in where they stand.
   */
  private fillDen(lane: number, reveal: boolean): void {
    const den = this.dens[lane];
    const queue = this.rules.lanes[lane];
    if (!den || !queue) return;
    const L = this.layout;
    const remaining = queue.length - den.front;
    const places = remaining > L.queueVisible ? L.queueVisible - 1 : remaining;
    while (den.views.length < places) {
      const k = den.views.length;
      const m = queue[den.front + k];
      if (!m) break;
      const at = denPoint(L, lane, k);
      const v = this.muncher(m.colour, m.appetite, at, k === 0 ? 'front' : 'queue');
      v.box.setScale(k === 0 ? 1 : MINI_SCALE);
      if (reveal) {
        v.box.setAlpha(0);
        this.tweens.add({ targets: v.box, alpha: 1, duration: QUEUE_REVEAL_MS });
      }
      den.views.push(v);
    }
    const hidden = remaining - den.views.length;
    const chip = denPoint(L, lane, den.views.length);
    den.more
      .setText(hidden > 0 ? `+${String(hidden)}` : '')
      .setPosition(chip.x, chip.y)
      .setVisible(hidden > 0);
  }

  /** A muncher view of colour index `colour` (into the rules' keys). */
  private muncher(
    colour: number,
    remaining: number,
    at: Point,
    place: Place,
    eaten = 0,
  ): MuncherView {
    const key = this.rules.keys[colour] as string;
    const fill = this.colours[colour] as number;
    return new MuncherView(this, key, fill, remaining, this.layout.muncherSize, at, place, eaten);
  }

  /**
   * The win and lose panels (GDD §9 screens 4–5): a dim over the dens, the round button over them
   * (the slots and the face stay in view: the cause of a loss, the reward of a win). The lose
   * panel slides up into place (GDD §3a stuck row) in PANEL_SLIDE_MS, before it takes a press
   * (PANEL_GUARD_MS).
   */
  private showPanel(): void {
    const { width, height } = this.scale.gameSize;
    const L = this.layout;
    const dim = this.add
      .rectangle(0, 0, width, height, 0x000000, PANEL_DIM)
      .setOrigin(0)
      .setDepth(DEPTH_DIM);
    // Above the dim: the board (DEPTH_BOARD) and the slot frames, with the stuck munchers on a
    // loss, so the face or the cause of the loss stays in view.
    for (const f of this.slotFrames) f.setDepth(DEPTH_DIM + 1);
    if (this.panel === 'lose') {
      for (const v of this.out.values()) v.box.setDepth(DEPTH_DIM + 2);
    }
    const first = L.slots[0] as Point;
    const last = L.slots.at(-1) as Point;
    const den = L.lanes[0] as Point;
    const at = { x: (first.x + last.x) / 2, y: den.y + PANEL_BUTTON_R - L.muncherSize / 2 };
    this.panelButton = at;
    const g = this.add.graphics();
    const s = PANEL_BUTTON_R * MARK_SHARE;
    if (this.panel === 'win') drawPlay(g, 0, 0, s, COLOR_BUTTON_MARK);
    else drawRetry(g, 0, 0, s, COLOR_BUTTON_MARK);
    const button = this.add
      .container(at.x, at.y, [this.add.circle(0, 0, PANEL_BUTTON_R, COLOR_BUTTON), g])
      .setDepth(DEPTH_PANEL);
    this.panelObjects = 2;
    // a fresh lose panel slides up from below the screen and the dim fades in; a redraw shows it
    // in place
    if (this.panel === 'lose' && this.clock - this.panelAt < PANEL_SLIDE_MS) {
      button.setY(height + PANEL_BUTTON_R);
      dim.setAlpha(0);
      this.tweens.add({ targets: button, y: at.y, duration: PANEL_SLIDE_MS, ease: 'Back.easeOut' });
      this.tweens.add({ targets: dim, alpha: 1, duration: PANEL_SLIDE_MS });
    }
  }

  private createTexture(): void {
    if (this.textures.exists(SNACK_KEY)) this.textures.remove(SNACK_KEY);
    this.texture = this.textures.createCanvas(SNACK_KEY, this.cols * TILE_PX, this.rows * TILE_PX);
    this.texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  private drawBoard(): void {
    for (let i = 0; i < this.original.length; i++) this.drawCell(i);
  }

  /** One cell: an uneaten tile with its bevel, the face flat, or nothing (the board shows). */
  private drawCell(i: number): void {
    const t = this.texture;
    if (!t) return;
    const ctx = t.getContext();
    const x = (i % this.cols) * TILE_PX;
    const y = Math.floor(i / this.cols) * TILE_PX;
    ctx.clearRect(x, y, TILE_PX, TILE_PX);
    const v = this.original[i] as number;
    if (this.revealed[i] === 1) {
      ctx.fillStyle = css(this.face.px[i] ?? COLOR_BOARD);
      ctx.fillRect(x, y, TILE_PX, TILE_PX);
    } else if (v !== EMPTY) {
      const c = this.colours[v] ?? COLOR_BOARD;
      ctx.fillStyle = css(c);
      ctx.fillRect(x, y, TILE_PX, TILE_PX);
      ctx.fillStyle = css(mixColour(c, 0xffffff, BEVEL_LIGHT));
      ctx.fillRect(x, y, TILE_PX, 1);
      ctx.fillRect(x, y, 1, TILE_PX);
      ctx.fillStyle = css(mixColour(c, 0x000000, BEVEL_DARK));
      ctx.fillRect(x, y + TILE_PX - 1, TILE_PX, 1);
      ctx.fillRect(x + TILE_PX - 1, y, 1, TILE_PX);
    }
    this.boardDirty = true;
  }

  /** The centre of snack cell `i`, written into `out` (the bite path allocates nothing). */
  private cellCentre(i: number, out: Point): Point {
    const L = this.layout;
    out.x = L.snack.x + ((i % this.cols) + 0.5) * L.cell;
    out.y = L.snack.y + (Math.floor(i / this.cols) + 0.5) * L.cell;
    return out;
  }

  /**
   * Platform pause: everything freezes (the scene clock, every tween, a running kick, haptics),
   * and no press from before it may count afterwards. A hit stop running into it restores only
   * its rates; nothing moves until the resume.
   */
  private setPaused(p: boolean): void {
    this.paused = p;
    setHapticsEnabled(!p);
    if (p) {
      this.pressed = null;
      this.panelPressed = false;
      this.tweens.pauseAll();
      // A kick must not run on under the pause (the camera is not on the scene clock).
      this.cameras.main.resetFX();
    } else {
      this.tweens.resumeAll();
      if (this.resizePending) {
        this.resizePending = false;
        this.onResize();
      }
    }
  }
}

/** `#rrggbb` for a canvas fill. */
function css(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}
