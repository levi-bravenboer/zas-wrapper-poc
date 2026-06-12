// Pure auto-layout pass for the dialog-driven builder
// (pathway-completion § C3). Block (x, y) is computed from the
// `input_logic` graph — the author never positions anything by hand.
//
// Per (phase, lane) cell:
//   1. Build a DAG: edge A → B when B's `input_logic.rules` reference A
//      (rule-level `node`) AND A lives in the same cell.
//   2. Kahn topological pass → column index (`col(b) = max(col(up)) + 1`).
//      Blocks with no in-cell upstream anchor at column 0. Upstream
//      references that live in ANOTHER cell don't shift the column —
//      cross-cell sequencing is conveyed by the derived edges, not by
//      intra-cell x-position.
//   3. Row index: per column, stack in stable order (creation order =
//      array order) → branch fan-outs stack vertically.
//
// Cycle safety: `input_logic` graphs are DAGs by construction, but
// autosave drafts can briefly hold cycles. Any block left unplaced by
// the Kahn pass lands in one trailing column, stacked, so the canvas
// never drops a block.

import {
  LAYOUT_CELL_X_PAD,
  LAYOUT_CELL_Y_PAD,
  LAYOUT_COLUMN_GUTTER,
  LAYOUT_ROW_GUTTER,
} from './constants'
import { BLOCK_HEIGHT, BLOCK_WIDTH } from '../canvasLayout'
import type { PathwayBlock, PathwayLane } from '../types'

export type BlockPosition = { x: number; y: number }

type LayoutBlock = Pick<PathwayBlock, 'id' | 'phase_id' | 'lane_id' | 'input_logic'>

function cellKey(block: LayoutBlock): string {
  return `${block.phase_id}::${block.lane_id}`
}

/** Rule-level upstream block ids referenced by `block.input_logic`. */
function upstreamIds(block: LayoutBlock): string[] {
  const rules = block.input_logic?.rules ?? []
  return rules.map((rule) => rule.node)
}

function layoutCell(cellBlocks: LayoutBlock[]): Map<string, BlockPosition> {
  const ids = new Set(cellBlocks.map((b) => b.id))

  // In-cell adjacency + indegrees.
  const inCellUpstream = new Map<string, string[]>()
  for (const block of cellBlocks) {
    inCellUpstream.set(
      block.id,
      upstreamIds(block).filter((up) => up !== block.id && ids.has(up)),
    )
  }

  // Kahn pass → column per block.
  const column = new Map<string, number>()
  let frontier = cellBlocks.filter((b) => (inCellUpstream.get(b.id) ?? []).length === 0)
  frontier.forEach((b) => column.set(b.id, 0))
  while (frontier.length > 0) {
    const next: LayoutBlock[] = []
    for (const candidate of cellBlocks) {
      if (column.has(candidate.id)) continue
      const ups = inCellUpstream.get(candidate.id) ?? []
      if (ups.every((up) => column.has(up))) {
        const col = Math.max(...ups.map((up) => column.get(up) ?? 0)) + 1
        column.set(candidate.id, col)
        next.push(candidate)
      }
    }
    if (next.length === 0) break
    frontier = next
  }

  // Cycle remainder → one trailing column, never dropped.
  const placedMax = Math.max(-1, ...column.values())
  for (const block of cellBlocks) {
    if (!column.has(block.id)) column.set(block.id, placedMax + 1)
  }

  // Row stacking per column, stable by array (creation) order.
  const rowCounter = new Map<number, number>()
  const positions = new Map<string, BlockPosition>()
  for (const block of cellBlocks) {
    const col = column.get(block.id) ?? 0
    const row = rowCounter.get(col) ?? 0
    rowCounter.set(col, row + 1)
    positions.set(block.id, {
      x: LAYOUT_CELL_X_PAD + col * (BLOCK_WIDTH + LAYOUT_COLUMN_GUTTER),
      y: LAYOUT_CELL_Y_PAD + row * (BLOCK_HEIGHT + LAYOUT_ROW_GUTTER),
    })
  }
  return positions
}

/**
 * Compute the (x, y) for every block, grouped per (phase, lane) cell.
 * Positions are relative to the cell origin — the canvas geometry adds
 * the phase column x + lane row y on top (see `blockOrigin`).
 */
export function computeBlockLayout(blocks: LayoutBlock[]): Map<string, BlockPosition> {
  const cells = new Map<string, LayoutBlock[]>()
  for (const block of blocks) {
    const key = cellKey(block)
    const bucket = cells.get(key)
    if (bucket) bucket.push(block)
    else cells.set(key, [block])
  }
  const out = new Map<string, BlockPosition>()
  for (const cellBlocks of cells.values()) {
    for (const [id, pos] of layoutCell(cellBlocks)) out.set(id, pos)
  }
  return out
}

/**
 * Lanes that hold at least one block (pathway-completion § C3.3).
 * Empty lanes are hidden so the canvas stays compact; ordering follows
 * `lane.ord` untouched. The dialog's lane picker keeps consuming the
 * FULL lane list — only the canvas render filters.
 */
export function visibleLanes(lanes: PathwayLane[], blocks: LayoutBlock[]): PathwayLane[] {
  const used = new Set(blocks.map((b) => b.lane_id))
  return lanes.filter((lane) => used.has(lane.id))
}
