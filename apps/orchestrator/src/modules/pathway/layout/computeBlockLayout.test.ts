import { describe, expect, it } from 'vitest'

import { BLOCK_HEIGHT, BLOCK_WIDTH } from '../canvasLayout'
import {
  LAYOUT_CELL_X_PAD,
  LAYOUT_CELL_Y_PAD,
  LAYOUT_COLUMN_GUTTER,
  LAYOUT_ROW_GUTTER,
} from './constants'
import { computeBlockLayout, visibleLanes } from './computeBlockLayout'
import type { PathwayLane } from '../types'

const PHASE_A = 'phase-a'
const LANE_SYS = 'lane-system'
const LANE_CARE = 'lane-caregiver'

type StubRule = { node: string; args: { predicate: string; after_block: string } }

function stubBlock(
  id: string,
  opts: { phase?: string; lane?: string; after?: string[] } = {},
) {
  const rules: StubRule[] = (opts.after ?? []).map((up) => ({
    node: up,
    args: { predicate: 'if_done', after_block: up },
  }))
  return {
    id,
    phase_id: opts.phase ?? PHASE_A,
    lane_id: opts.lane ?? LANE_SYS,
    input_logic: { rules, aggregator: 'all_of' },
  } as never
}

function colX(col: number): number {
  return LAYOUT_CELL_X_PAD + col * (BLOCK_WIDTH + LAYOUT_COLUMN_GUTTER)
}

function rowY(row: number): number {
  return LAYOUT_CELL_Y_PAD + row * (BLOCK_HEIGHT + LAYOUT_ROW_GUTTER)
}

describe('computeBlockLayout', () => {
  it('lays out a linear chain left-to-right', () => {
    const layout = computeBlockLayout([
      stubBlock('a'),
      stubBlock('b', { after: ['a'] }),
      stubBlock('c', { after: ['b'] }),
    ])
    expect(layout.get('a')).toEqual({ x: colX(0), y: rowY(0) })
    expect(layout.get('b')).toEqual({ x: colX(1), y: rowY(0) })
    expect(layout.get('c')).toEqual({ x: colX(2), y: rowY(0) })
  })

  it('stacks decision fan-out vertically in the next column', () => {
    const layout = computeBlockLayout([
      stubBlock('decision'),
      stubBlock('branch-yes', { after: ['decision'] }),
      stubBlock('branch-no', { after: ['decision'] }),
    ])
    expect(layout.get('decision')).toEqual({ x: colX(0), y: rowY(0) })
    expect(layout.get('branch-yes')).toEqual({ x: colX(1), y: rowY(0) })
    expect(layout.get('branch-no')).toEqual({ x: colX(1), y: rowY(1) })
  })

  it('ignores upstream references that live in another cell', () => {
    // `care-task` waits on `sys-start`, but they sit in different lanes —
    // cross-cell sequencing is drawn by edges, not intra-cell columns.
    const layout = computeBlockLayout([
      stubBlock('sys-start', { lane: LANE_SYS }),
      stubBlock('care-task', { lane: LANE_CARE, after: ['sys-start'] }),
    ])
    expect(layout.get('sys-start')).toEqual({ x: colX(0), y: rowY(0) })
    expect(layout.get('care-task')).toEqual({ x: colX(0), y: rowY(0) })
  })

  it('joins fan-in at max(upstream column) + 1', () => {
    const layout = computeBlockLayout([
      stubBlock('a'),
      stubBlock('b', { after: ['a'] }),
      stubBlock('join', { after: ['a', 'b'] }),
    ])
    expect(layout.get('join')).toEqual({ x: colX(2), y: rowY(0) })
  })

  it('never drops blocks on a cycle — trailing column fallback', () => {
    const layout = computeBlockLayout([
      stubBlock('x', { after: ['y'] }),
      stubBlock('y', { after: ['x'] }),
    ])
    expect(layout.get('x')).toBeDefined()
    expect(layout.get('y')).toBeDefined()
    // Both stacked in the same fallback column.
    expect(layout.get('x')?.x).toBe(layout.get('y')?.x)
    expect(layout.get('x')?.y).not.toBe(layout.get('y')?.y)
  })

  it('keeps independent cells independent', () => {
    const layout = computeBlockLayout([
      stubBlock('a', { phase: 'p1' }),
      stubBlock('b', { phase: 'p2', after: ['a'] }),
    ])
    // b's upstream is in another phase → b anchors at column 0 of its own cell.
    expect(layout.get('b')).toEqual({ x: colX(0), y: rowY(0) })
  })
})

describe('visibleLanes', () => {
  const lanes = [
    { id: LANE_SYS, ord: 10 },
    { id: LANE_CARE, ord: 20 },
    { id: 'lane-external', ord: 30 },
  ] as PathwayLane[]

  it('hides lanes with no blocks', () => {
    const visible = visibleLanes(lanes, [stubBlock('a', { lane: LANE_SYS })])
    expect(visible.map((l) => l.id)).toEqual([LANE_SYS])
  })

  it('keeps lane ordering for used lanes', () => {
    const visible = visibleLanes(lanes, [
      stubBlock('a', { lane: LANE_CARE }),
      stubBlock('b', { lane: LANE_SYS }),
    ])
    expect(visible.map((l) => l.id)).toEqual([LANE_SYS, LANE_CARE])
  })

  it('returns empty when no blocks exist', () => {
    expect(visibleLanes(lanes, [])).toEqual([])
  })
})
