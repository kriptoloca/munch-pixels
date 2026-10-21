/**
 * Design-space constants (GDD §10, CLAUDE.md rule 5). All positions are in design px: the short
 * side of the canvas is always DESIGN_SHORT, the long side follows the window aspect and is
 * clamped to DESIGN_LONG_MAX.
 */
export const DESIGN_SHORT = 1080;
/** Long side cap (≈ 20:9). Taller or wider viewports get letterboxed by Scale.FIT. */
export const DESIGN_LONG_MAX = 2400;

/** Page and canvas background behind everything (also index.html and the Phaser config). */
export const COLOR_PAGE = 0x1b1f2a;
export const COLOR_PAGE_CSS = '#1b1f2a';

// ---- Game screen layout (GDD §10; src/game/layout.ts) ----------------------------------------

/** Outer margin of the game screen. */
export const MARGIN = 40;
/** Vertical gap between the snack, the slot row and the dens. */
export const GAP = 24;
/** Top band (level number left, pause right) in portrait. */
export const HUD_H = 150;
/** Bottom band (the two booster buttons) in portrait. */
export const BOOSTER_BAND_H = 170;
/** Side columns (HUD on top, boosters below) in the square layout. */
export const SIDE_COL_W = 170;
/** Largest snack square. */
export const SNACK_MAX = 900;
/** Slot size cap and the gap between slots. */
export const SLOT_MAX = 150;
export const SLOT_GAP = 18;
/** Munchers are this share of a slot. */
export const MUNCHER_SCALE = 0.82;
/** Space between a den's front muncher and the queue behind it. */
export const QUEUE_GAP = 12;
/**
 * The queue behind the front shows as small munchers (this share of the front's size), as deep
 * as the screen allows, with a "+N" chip for the rest (GDD §2, docs/questions.md Epic 3).
 */
export const MINI_SCALE = 0.5;
export const MINI_GAP = 6;
/** Places per den (the front included): at least four on every screen, at most twelve. */
export const QUEUE_MIN_VISIBLE = 4;
export const QUEUE_MAX_VISIBLE = 12;
/** Den columns are at most this far apart (centre to centre). */
export const LANE_SPACING_MAX = 210;
/** Tap targets: hit circle radius max(HIT_MIN_R, size / 2) (CLAUDE.md "Taps"). */
export const HIT_MIN_R = 60;
/** Booster and pause buttons. */
export const BOOSTER_R = 64;
export const PAUSE_R = 56;
/** H / W at or above this is portrait (bands); W / H at or above LANDSCAPE_MIN_ASPECT, landscape
 * (split); anything in between uses the square arrangement. */
export const PORTRAIT_MIN_ASPECT = 1.5;
export const LANDSCAPE_MIN_ASPECT = 1.6;

/** Board background behind the snack, slot and den colours (graybox; art in Epic 4). */
export const COLOR_SLOT = 0x2e3650;
export const COLOR_SLOT_WAIT = 0xf7b32b;
export const COLOR_DEN = 0x252b3d;

// ---- Game screen drawing (graybox; Epic 4 replaces the look, not the sizes) ------------------

/** Canvas pixels per snack cell: room for the tile bevel (GDD §4). */
export const TILE_PX = 8;
/** Bevel of an uneaten tile: its top-left edge mixed towards white, bottom-right towards black. */
export const BEVEL_LIGHT = 0.3;
export const BEVEL_DARK = 0.3;
/** The board panel reaches this far past the snack, with these rounded corners. */
export const BOARD_PAD = 16;
export const BOARD_RADIUS = 24;
/**
 * The win grows the board (WIN_FACE_SCALE) only as far as this many design px short of anything
 * next to it and of the canvas edge (`winScale` in src/game/layout.ts, tests/layout.test.ts).
 */
export const BOARD_GROW_CLEAR = 2;
/** Slot frame line and corner radius (a rounded plate per slot). */
export const SLOT_STROKE = 6;
export const SLOT_RADIUS = 22;
/** The ink muncher's light ring (it would vanish on the dark page without it, Epic 3). */
export const COLOR_MUNCHER_RING = 0xd8dce8;
/**
 * The "+N" chip (the munchers past a den's last place): its digits are this much larger than a
 * queued muncher's appetite digit (DIGIT_QUEUE in src/game/muncher-art.ts), never under
 * DIGIT_MIN_PX (tests/textures.test.ts).
 */
export const CHIP_FONT_GROW = 1.2;
/** Dark stroke around the appetite digits. */
export const COLOR_LABEL_STROKE = '#1b1f2a';

// ---- muncher art (Epic 4; shapes in src/game/muncher-art.ts) ---------------------------------

/**
 * Muncher textures are drawn at Boot at this size: the largest muncher on screen (123 design px
 * on 9:16) with its belly swelled 30 % and a full-meal bounce of 1.2 stays at or under it.
 */
export const MUNCHER_TEX_PX = 192;
/** Appetite digit stroke, as a share of its font size. */
export const DIGIT_STROKE_SHARE = 0.22;
/** No appetite digit is drawn smaller than this (design px; tests/textures.test.ts). */
export const DIGIT_MIN_PX = 30;
/** The squash and the belly swell pivot at the feet: this far below the muncher's centre. */
export const MUNCHER_FOOT_SHARE = 0.45;
/** Burp puffs. */
export const COLOR_PUFF = 0xe9ecf3;
/** HUD level number. */
export const LEVEL_FONT_PX = 64;
/** At most three digits (GDD §9) at LEVEL_FONT_PX fit this box, left-aligned on `layout.level`. */
export const LEVEL_LABEL_W = 120;
export const LEVEL_LABEL_H = 90;

// ---- effect pools and audio plumbing (src/game/fx.ts, src/game/audio.ts) ----------------------

/**
 * Effect pools, created with the board: what a level needs at its normal pace (a flight lives
 * 200 ms and one leaves every 70 ms, three crumbs each live 280 ms, a full meal puffs three
 * clouds), with room. The confetti pool holds CONFETTI_COUNT (src/game/feel.ts).
 */
export const FX_POOL_FLIGHTS = 8;
export const FX_POOL_CRUMBS = 24;
export const FX_POOL_PUFFS = 9;
/**
 * The bite tick plays many times a second: from this many reused sound instances, round-robin,
 * instead of a new sound object (and its audio nodes) per play.
 */
export const SFX_POOL_BITE = 4;
/** Dev audio state: the last this many SFX keys started. */
export const AUDIO_DEBUG_HISTORY = 12;
/** Samples per read of the master-bus level (the e2e tells "playing" from "audible" with it). */
export const AUDIO_ANALYSER_FFT = 2048;
/** Win and lose panels: page dim and the round button. */
export const PANEL_DIM = 0.6;
export const PANEL_BUTTON_R = 110;
export const COLOR_BUTTON = 0xf7b32b;
export const COLOR_BUTTON_MARK = 0x1b1f2a;
