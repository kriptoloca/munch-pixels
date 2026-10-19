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
/** Slot frame line; the light ring around every muncher disc (ink munchers on the dark page). */
export const SLOT_STROKE = 6;
export const MUNCHER_RING = 5;
export const COLOR_MUNCHER_RING = 0xd8dce8;
/** Appetite digits: this share of the disc size, with a dark stroke. */
export const LABEL_FONT_SHARE = 0.42;
export const LABEL_STROKE = 8;
export const COLOR_LABEL_STROKE = '#1b1f2a';
/** HUD level number. */
export const LEVEL_FONT_PX = 64;
/** Win and lose panels: page dim and the round button. */
export const PANEL_DIM = 0.6;
export const PANEL_BUTTON_R = 110;
export const COLOR_BUTTON = 0xf7b32b;
export const COLOR_BUTTON_MARK = 0x1b1f2a;
