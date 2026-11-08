// Pathway-completion §C3: auto-layout from `input_logic`. Per phase,
// Kahn pass across lanes assigns columns (parallel work in different
// lanes shares a column when they hit the same upstream). Rows stack
// per (phase, lane). Cycles fall to a trailing column — never drop a
// block.

import { BLOCK_HEIGHT, BLOCK_WIDTH } from '../canvasLayout'
import type { PathwayBlock, PathwayLane } from '../types'

import {
  LAYOUT_CELL_X_PAD,
  LAYOUT_CELL_Y_PAD,
  LAYOUT_COLUMN_GUTTER,
  LAYOUT_ROW_GUTTER,
} from './constants'

export type BlockPosition = { x: number; y: number }

type LayoutBlock = Pick<PathwayBlock, 'id' | 'phase_id' | 'lane_id' | 'input_logic'>

/** Rule-level upstream block ids referenced by `block.input_logic`. */
function upstreamIds(block: LayoutBlock): string[] {
  const rules = block.input_logic?.rules ?? []
  return rules.map((rule) => rule.node)
}

/** Topological column index per block, scoped to a single phase. */
function columnsForPhase(phaseBlocks: LayoutBlock[]): Map<string, number> {
  const ids = new Set(phaseBlocks.map((b) => b.id))
  const inPhaseUpstream = new Map<string, string[]>()
  for (const block of phaseBlocks) {
    inPhaseUpstream.set(
      block.id,
      upstreamIds(block).filter((up) => up !== block.id && ids.has(up)),
    )
  }

  const column = new Map<string, number>()
  let frontier = phaseBlocks.filter((b) => (inPhaseUpstream.get(b.id) ?? []).length === 0)
  frontier.forEach((b) => column.set(b.id, 0))
  while (frontier.length > 0) {
    const next: LayoutBlock[] = []
    for (const candidate of phaseBlocks) {
      if (column.has(candidate.id)) continue
      const ups = inPhaseUpstream.get(candidate.id) ?? []
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
  for (const block of phaseBlocks) {
    if (!column.has(block.id)) column.set(block.id, placedMax + 1)
  }

  return column
}

/**
 * Compute the (x, y) for every block, grouped per (phase, lane) cell.
 * Columns are phase-wide so parallel work in different lanes lines up;
 * rows stack inside each (phase, lane) cell. Positions are relative
 * to the cell origin — the canvas geometry adds phase column x + lane
 * row y on top (see `blockOrigin`).
 */
export function computeBlockLayout(blocks: LayoutBlock[]): Map<string, BlockPosition> {
  const phases = new Map<string, LayoutBlock[]>()
  for (const block of blocks) {
    const bucket = phases.get(block.phase_id)
    if (bucket) bucket.push(block)
    else phases.set(block.phase_id, [block])
  }

  const out = new Map<string, BlockPosition>()
  for (const phaseBlocks of phases.values()) {
    const column = columnsForPhase(phaseBlocks)
    // Row counter is per (lane, column) — branches that fan out within
    // one lane stack vertically; the next lane starts fresh.
    const rowCounter = new Map<string, number>()
    for (const block of phaseBlocks) {
      const col = column.get(block.id) ?? 0
      const rowKey = `${block.lane_id}::${col}`
      const row = rowCounter.get(rowKey) ?? 0
      rowCounter.set(rowKey, row + 1)
      out.set(block.id, {
        x: LAYOUT_CELL_X_PAD + col * (BLOCK_WIDTH + LAYOUT_COLUMN_GUTTER),
        y: LAYOUT_CELL_Y_PAD + row * (BLOCK_HEIGHT + LAYOUT_ROW_GUTTER),
      })
    }
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
