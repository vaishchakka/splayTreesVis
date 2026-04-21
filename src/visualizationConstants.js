/**
 * Shared layout + typography for splay visualization (tree spacing vs captions).
 */

/** Horizontal subtree spacing — must stay ≥ largest node circle width used in layout. */
export const WIDTH_DELTA = 92;
/** Vertical distance between BST levels. */
export const HEIGHT_DELTA = 78;
/**
 * Root row Y — must clear multi-line status captions (object id 0) and DOM chrome.
 */
export const STARTING_Y = 210;
/** Center Y of the top status caption (object id 0). */
export const STATUS_CAPTION_CENTER_Y = 52;
/** Nodes built off-screen before layout; keep well below the visible tree. */
export const OFFSCREEN_BUILD_OFFSET = 520;

export const CAPTION_FONT_PX = 17;
export const CAPTION_LINE_GAP_PX = 24;

/** Numeric key label inside each node circle. */
export const NODE_KEY_FONT_PX = 15;

/** Circle graphic width by depth (see applyMemoryDepthStyleCommands). */
export const NODE_CIRCLE_WIDTH_ROOT = 76;
export const NODE_CIRCLE_WIDTH_SHALLOW = 62;
export const NODE_CIRCLE_WIDTH_DEEP = 50;

/** Dual-forest horizontal centers (fraction of canvas width) — wider nodes need more gap. */
export const DUAL_FOREST_CENTER_LEFT = 0.22;
export const DUAL_FOREST_CENTER_RIGHT = 0.78;
