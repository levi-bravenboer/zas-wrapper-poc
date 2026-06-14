// Auto-layout constants for the dialog-driven builder
// (pathway-completion § C3). Block (x, y) is computed, never authored —
// see `computeBlockLayout.ts`.

/** Horizontal gap between topological columns inside a phase × lane cell. */
export const LAYOUT_COLUMN_GUTTER = 48

/** Vertical gap between stacked branch rows inside one column. */
export const LAYOUT_ROW_GUTTER = 32

/** Left padding from the cell (phase column) edge to the first column. */
export const LAYOUT_CELL_X_PAD = 32

/** Top padding from the cell (lane row) edge to the first row. */
export const LAYOUT_CELL_Y_PAD = 28
