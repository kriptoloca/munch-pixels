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
  COLOR_LABEL_STROKE,
  COLOR_MUNCHER_RING,
  COLOR_SLOT,
  COLOR_SLOT_WAIT,
  LABEL_FONT_SHARE,
  LABEL_STROKE,
  LEVEL_FONT_PX,
  MINI_SCALE,
  MUNCHER_RING,
  PANEL_BUTTON_R,
  PANEL_DIM,
  SLOT_STROKE,
  TILE_PX,
} from '../../config';
import { levelFor } from '../../data/levels';
import { COLOR_BOARD, colourOf } from '../../data/palette';
import { uninstallDebug } from '../../dev/debug';
import type { GameProbe } from '../../dev/game-debug';
import { drawFace, type FacePicture } from '../../gen/face';
import type { Level } from '../../gen/level';
import { track } from '../../platform/analytics';
import { getPlatform, markInteractive } from '../../platform/bridge';
import {
  BITE_END_SCALE,
  BITE_FLIGHT_MS,
  FAST_FLIGHT_MS,
  HOP_MS,
  LAG_LIMIT_MS,
  LAG_SKIP_MS,
  LEAVE_MS,
  LEVEL_START_GUARD_MS,
  NOPE_SHAKE_MS,
  NOPE_SHAKE_PX,
  PANEL_GUARD_MS,
  QUEUE_REVEAL_MS,
  WAKE_JUMP_PX,
  WAKE_MS,
} from '../feel';
import { drawPlay, drawRetry } from '../glyphs';
import {
  computeLayout,
  denPoint,
  pickDen,
  type DenHit,
  type GameLayout,
  type Point,
} from '../layout';
import { ResumeGrace, bindPauseGrace } from '../resume-grace';
import { persistProgress, progress } from '../state';
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
/** The "+N" chip's digits are this much larger than a queued muncher's. */
const MORE_FONT_GROW = 1.2;

/** A muncher on screen: a disc in its colour with its remaining appetite (graybox). */
class MuncherView {
  readonly box: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;
  private shown: number;
  private gone = false;

  constructor(scene: Phaser.Scene, colour: number, remaining: number, size: number, at: Point) {
    // A light ring: the ink-coloured munchers would vanish on the dark page without it.
    const disc = scene.add
      .circle(0, 0, size / 2, colour)
      .setStrokeStyle(MUNCHER_RING, COLOR_MUNCHER_RING);
    this.shown = remaining;
    this.label = scene.add
      .text(0, 0, String(remaining), {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${String(Math.round(size * LABEL_FONT_SHARE))}px`,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: COLOR_LABEL_STROKE,
        strokeThickness: LABEL_STROKE,
      })
      .setOrigin(0.5);
    this.box = scene.add.container(at.x, at.y, [disc, this.label]);
  }

  /** The appetite digit on screen. */
  get digit(): number {
    return this.shown;
  }

  /** A bite landed (a late flight may land after the muncher left: then nothing happens). */
  eat(): void {
    if (this.gone) return;
    this.shown = Math.max(0, this.shown - 1);
    this.label.setText(String(this.shown));
  }

  destroy(): void {
    this.gone = true;
    this.box.destroy();
  }
}

/** One den on screen: views for the visible places, front first, and the "+N" chip. */
interface Den {
  views: MuncherView[];
  /** Rules index (in the lane) of `views[0]`: how many hops of this lane have played. */
  front: number;
  more: Phaser.GameObjects.Text;
}

/**
 * Game (GDD §2, §9 screen 3), Epic 3 graybox: the snack drawn into one canvas texture, the slot
 * row, the dens, taps, the rules resolving at once and the Timeline playing them back, the win
 * and lose panels, and progress. The art and the juice of the Feel spec arrive in Epic 4.
 */
export class GameScene extends Phaser.Scene {
  private readonly grace = new ResumeGrace(this);
  private level!: Level;
  /** The rules of the level being played. */
  private rules!: Game;
  private colours: number[] = [];
  /** The snack as drawn at the start (the rules' board only knows what is eaten now). */
  private original!: Int8Array;
  private face!: FacePicture;
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
  private flights: Phaser.GameObjects.Rectangle[] = [];
  private panel: 'win' | 'lose' | null = null;
  /** Scene time when the panel opened. */
  private panelAt = 0;
  private panelButton: Point | null = null;
  /** A resize that came during a pause, drawn on resume (nothing plays under a pause). */
  private resizePending = false;
  private pressed: DenHit = null;
  /** A press that began on the open panel (a press from before it opened never counts). */
  private panelPressed = false;
  private nopes = 0;
  /** Created once: `update` hands it to the timeline every frame without allocating. */
  private readonly playAction = (a: Action): void => {
    this.play(a);
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
    this.face = drawFace(this.level.face, this.cols, this.rows);
    this.revealed = new Uint8Array(board.cells.length);
    this.timeline = new Timeline();
    this.clock = 0;
    this.panel = null;
    this.panelAt = 0;
    this.resizePending = false;
    this.pressed = null;
    this.panelPressed = false;
    this.nopes = 0;
    this.tweens.setLagSmooth(LAG_LIMIT_MS, LAG_SKIP_MS);
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
        motion: () =>
          this.children.list.reduce((sum, c) => {
            const o = c as Phaser.GameObjects.Container;
            return sum + o.x + o.y + o.alpha + o.scaleX;
          }, 0),
        inputOpen: () => !this.paused && this.panel === null && this.clock >= LEVEL_START_GUARD_MS,
        panelReady: () => this.panel !== null && this.clock - this.panelAt >= PANEL_GUARD_MS,
        faded: () =>
          this.dens.reduce(
            (n, d) => n + d.views.filter((v) => !v.box.visible || v.box.alpha < 1).length,
            0,
          ),
        screen: () => ({
          seats: this.rules.slots.map((s) => {
            const v = s ? this.out.get(muncherId(s.lane, s.index)) : undefined;
            return v
              ? { digit: v.digit, alpha: v.box.visible ? v.box.alpha : 0, x: v.box.x, y: v.box.y }
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
      };
      void import('../../dev/game-debug').then((m) => {
        if (this.scene.isActive()) m.installGameDebug(probe);
      });
    }
  }

  override update(_time: number, delta: number): void {
    if (this.paused) return;
    // The same stall rule as the tweens (setLagSmooth), so flights and bites stay in step.
    this.clock += delta > LAG_LIMIT_MS ? LAG_SKIP_MS : delta;
    this.timeline.drain(this.clock, this.playAction);
    if (this.boardDirty && this.texture) {
      this.texture.refresh();
      this.boardDirty = false;
    }
  }

  // ---- input --------------------------------------------------------------------------------

  private onDown(p: Phaser.Input.Pointer): void {
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

  /** A tap on a muncher behind the front (GDD §3a): it shakes its head ±6 px, the front bobs. */
  private nope(lane: number, k: number): void {
    this.nopes += 1;
    const den = this.dens[lane];
    const view = den?.views[k];
    if (view) {
      const at = denPoint(this.layout, lane, k);
      this.tweens.killTweensOf(view.box);
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
    if (front) this.bounce(front, denPoint(this.layout, lane, 0), WAKE_JUMP_PX / 2);
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
      case 'won':
        this.revealed.fill(1);
        this.drawBoard();
        this.panel = 'win';
        this.panelAt = this.clock;
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
        this.animateHop(a.who, a.lane, a.slot, a.fast);
        break;
      case 'bite':
        this.animateBite(a.who, a.slot, a.cell, a.fast);
        break;
      case 'full':
        this.animateLeave(a.who, a.slot, a.fast);
        break;
      case 'wait':
        this.slotFrames[a.slot]?.setStrokeStyle(SLOT_STROKE, COLOR_SLOT_WAIT);
        break;
      case 'wake': {
        this.slotFrames[a.slot]?.setStrokeStyle(SLOT_STROKE, COLOR_BOARD);
        const v = this.out.get(a.who);
        if (v) this.bounce(v, this.layout.slots[a.slot] as Point, WAKE_JUMP_PX);
        break;
      }
      case 'won':
      case 'lost':
        this.showPanel();
        break;
    }
  }

  /** A jump up and back to `at` (the resting place, never a position caught mid-tween). */
  private bounce(view: MuncherView, at: Point, height: number): void {
    this.tweens.killTweensOf(view.box);
    view.box.setPosition(at.x, at.y).setScale(1).setAlpha(1);
    this.tweens.add({ targets: view.box, y: at.y - height, duration: WAKE_MS / 2, yoyo: true });
  }

  private animateHop(who: string, lane: number, slot: number, fast: boolean): void {
    const den = this.dens[lane];
    const view = den?.views.shift();
    if (!den || !view) return;
    den.front += 1;
    this.out.set(who, view);
    const to = this.layout.slots[slot] as Point;
    const ms = fast ? FAST_FLIGHT_MS : HOP_MS;
    // A killed fade-in never leaves a muncher faded: whatever moves is fully drawn at once
    // (a tween reads its start value on its first update, so a fade killed every frame by
    // fast taps would never progress; audit 2026-10-19).
    this.tweens.killTweensOf(view.box);
    view.box.setAlpha(1);
    this.tweens.add({
      targets: view.box,
      x: to.x,
      y: to.y,
      scale: 1,
      duration: ms,
      ease: 'Quad.easeOut',
    });
    den.views.forEach((v, k) => {
      const p = denPoint(this.layout, lane, k);
      this.tweens.killTweensOf(v.box);
      v.box.setAlpha(1);
      this.tweens.add({
        targets: v.box,
        x: p.x,
        y: p.y,
        scale: k === 0 ? 1 : MINI_SCALE,
        duration: ms,
      });
    });
    this.fillDen(lane, true);
  }

  private animateBite(who: string, slot: number, cell: number, fast: boolean): void {
    const view = this.out.get(who);
    const to = this.layout.slots[slot] as Point;
    const from = this.cellCentre(cell);
    const colour = this.colours[this.original[cell] as number] ?? COLOR_BOARD;
    const r = this.flights.pop() ?? this.add.rectangle(0, 0, 1, 1, colour).setDepth(DEPTH_FLIGHT);
    r.setPosition(from.x, from.y)
      .setSize(this.layout.cell, this.layout.cell)
      .setFillStyle(colour)
      .setScale(1)
      .setVisible(true);
    this.tweens.add({
      targets: r,
      x: to.x,
      y: to.y,
      scale: BITE_END_SCALE,
      duration: fast ? FAST_FLIGHT_MS : BITE_FLIGHT_MS,
      ease: 'Quad.easeIn',
      onComplete: () => {
        r.setVisible(false);
        this.flights.push(r);
        view?.eat();
      },
    });
  }

  private animateLeave(who: string, slot: number, fast: boolean): void {
    const view = this.out.get(who);
    this.out.delete(who);
    this.slotFrames[slot]?.setStrokeStyle(SLOT_STROKE, COLOR_BOARD);
    if (!view) return;
    const at = this.layout.slots[slot] as Point;
    this.tweens.killTweensOf(view.box);
    view.box.setPosition(at.x, at.y).setScale(1);
    this.tweens.add({
      targets: view.box,
      y: at.y - this.layout.slotSize,
      alpha: 0,
      duration: fast ? FAST_FLIGHT_MS : LEAVE_MS,
      onComplete: () => {
        view.destroy();
      },
    });
  }

  // ---- drawing ------------------------------------------------------------------------------

  private onResize(): void {
    const { width, height } = this.scale.gameSize;
    if (width === this.drawnFor.width && height === this.drawnFor.height) return;
    if (this.paused) {
      this.resizePending = true;
      return;
    }
    // Play out whatever is pending (state only), then draw everything again at the new size.
    this.timeline.flush((a) => {
      this.apply(a);
    });
    this.render();
  }

  /** Draws the whole screen from the rules' state and the revealed cells. */
  private render(): void {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.flights = [];
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
    this.add
      .text(L.level.x, L.level.y, String(this.level.id), {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${String(LEVEL_FONT_PX)}px`,
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5);
    this.add
      .graphics()
      .setDepth(DEPTH_BOARD - 1)
      .fillStyle(COLOR_BOARD)
      .fillRoundedRect(
        L.snack.x - BOARD_PAD,
        L.snack.y - BOARD_PAD,
        L.snack.w + 2 * BOARD_PAD,
        L.snack.h + 2 * BOARD_PAD,
        BOARD_RADIUS,
      );
    this.add
      .image(L.snack.x, L.snack.y, SNACK_KEY)
      .setOrigin(0)
      .setDisplaySize(L.snack.w, L.snack.h)
      .setDepth(DEPTH_BOARD);
    this.drawBoard();

    this.slotFrames = L.slots.map((p, i) => {
      const waiting = this.rules.slots[i]?.waiting === true;
      return this.add
        .rectangle(p.x, p.y, L.slotSize, L.slotSize, COLOR_SLOT)
        .setStrokeStyle(SLOT_STROKE, waiting ? COLOR_SLOT_WAIT : COLOR_BOARD);
    });
    const seats = this.rules.slots.map((s, i) => {
      if (!s) return null;
      const who = muncherId(s.lane, s.index);
      const at = L.slots[i] as Point;
      const colour = this.colours[s.colour] as number;
      this.out.set(who, new MuncherView(this, colour, s.remaining, L.muncherSize, at));
      return who;
    });
    this.timeline.reset(seats);
    const moreFont = `${String(Math.round(L.miniSize * LABEL_FONT_SHARE * MORE_FONT_GROW))}px`;
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
      const colour = this.colours[m.colour] as number;
      const v = new MuncherView(this, colour, m.appetite, L.muncherSize, at);
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

  private showPanel(): void {
    const { width, height } = this.scale.gameSize;
    const L = this.layout;
    this.add.rectangle(0, 0, width, height, 0x000000, PANEL_DIM).setOrigin(0).setDepth(DEPTH_DIM);
    // Above the dim: the board (DEPTH_BOARD) and the slot frames, with the stuck munchers on a
    // loss, so the face or the cause of the loss stays in view.
    for (const f of this.slotFrames) f.setDepth(DEPTH_DIM + 1);
    if (this.panel === 'lose') {
      for (const v of this.out.values()) v.box.setDepth(DEPTH_DIM + 2);
    }
    // Over the dens (the slots and the face stay in view: the cause of a loss, the reward of a
    // win), centred on the play column.
    const first = L.slots[0] as Point;
    const last = L.slots.at(-1) as Point;
    const den = L.lanes[0] as Point;
    const at = { x: (first.x + last.x) / 2, y: den.y + PANEL_BUTTON_R - L.muncherSize / 2 };
    this.panelButton = at;
    this.add.circle(at.x, at.y, PANEL_BUTTON_R, COLOR_BUTTON).setDepth(DEPTH_PANEL);
    const g = this.add.graphics().setDepth(DEPTH_PANEL + 1);
    const s = PANEL_BUTTON_R * MARK_SHARE;
    if (this.panel === 'win') drawPlay(g, at.x, at.y, s, COLOR_BUTTON_MARK);
    else drawRetry(g, at.x, at.y, s, COLOR_BUTTON_MARK);
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
      ctx.fillStyle = css(mix(c, 0xffffff, BEVEL_LIGHT));
      ctx.fillRect(x, y, TILE_PX, 1);
      ctx.fillRect(x, y, 1, TILE_PX);
      ctx.fillStyle = css(mix(c, 0x000000, BEVEL_DARK));
      ctx.fillRect(x, y + TILE_PX - 1, TILE_PX, 1);
      ctx.fillRect(x + TILE_PX - 1, y, 1, TILE_PX);
    }
    this.boardDirty = true;
  }

  private cellCentre(i: number): Point {
    const L = this.layout;
    return {
      x: L.snack.x + ((i % this.cols) + 0.5) * L.cell,
      y: L.snack.y + (Math.floor(i / this.cols) + 0.5) * L.cell,
    };
  }

  /** Platform pause: everything freezes, and no press from before it may count afterwards. */
  private setPaused(p: boolean): void {
    this.paused = p;
    if (p) {
      this.pressed = null;
      this.panelPressed = false;
      this.tweens.pauseAll();
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

/** `a` moved towards `b` by `t` (0..1), per channel. */
function mix(a: number, b: number, t: number): number {
  const ch = (s: number): number => {
    const x = (a >> s) & 255;
    const y = (b >> s) & 255;
    return Math.round(x + (y - x) * t) << s;
  };
  return ch(16) | ch(8) | ch(0);
}
