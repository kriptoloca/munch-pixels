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
