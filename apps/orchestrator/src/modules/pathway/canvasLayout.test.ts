import { describe, expect, it } from 'vitest'

import {
  BLOCK_DEFAULT_X,
  BLOCK_DEFAULT_Y,
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  LANE_INSET,
  LANE_ROW_HEIGHT,
  blockOrigin,
  buildCanvasGeometry,
  laneInset,
} from './canvasLayout'
import type { PathwayLane, PathwayPhase } from './types'

const phases = [
  { id: 'p1', template_id: null, label: 'P1', ord: 0, width_px: 380 },
  { id: 'p2', template_id: null, label: 'P2', ord: 1, width_px: 380 },
] as unknown as PathwayPhase[]

const lanes = [
  {
    id: 'l1',
    pathway_lane_kind_id: 'k1',
    lane_kind_code: 'patient',
    label: 'L1',
    ord: 0,
    is_default: true,
    height_px: LANE_ROW_HEIGHT,
  },
  {
    id: 'l2',
    pathway_lane_kind_id: 'k2',
    lane_kind_code: 'external',
    label: 'L2',
    ord: 1,
    is_default: false,
    height_px: LANE_ROW_HEIGHT,
  },
] as unknown as PathwayLane[]

describe('laneInset', () => {
  it('returns the historic 26 for a native 64-tall block in a 180-tall lane', () => {
    // Pre-refactor: BLOCK_DEFAULT_Y = LANE_INSET - BLOCK_HEIGHT/2 = 58 - 32 = 26.
    // The new function must preserve this for the native case.
    expect(laneInset(BLOCK_HEIGHT, LANE_ROW_HEIGHT)).toBe(BLOCK_DEFAULT_Y)
    expect(laneInset(64, 180)).toBe(26)
  })

  it('matches LANE_INSET - blockHeight/2 inside the safe range', () => {
    expect(laneInset(40, 220)).toBe(LANE_INSET - 20)
    expect(laneInset(80, 220)).toBe(LANE_INSET - 40)
  })

  it('clamps to 0 when the reference offset would be negative (tall block)', () => {
    // 200-tall Luscii block in a 250-tall lane: 58 - 100 = -42 → clamped to 0
    expect(laneInset(200, 250)).toBe(0)
    expect(laneInset(300, 320)).toBe(0)
  })

  it('clamps to 0 when block matches or exceeds lane height (defensive)', () => {
    expect(laneInset(180, 180)).toBe(0)
    expect(laneInset(300, 200)).toBe(0)
  })
})

describe('blockOrigin', () => {
  const geometry = buildCanvasGeometry(phases, lanes)

  it('honours an explicitly stored block.y position regardless of dimensions', () => {
    const origin = blockOrigin({ phase_id: 'p1', lane_id: 'l1', x: 10, y: 100 }, geometry)
    expect(origin.x).toBe(geometry.phaseX('p1') + 10)
    expect(origin.y).toBe(geometry.laneY('l1') + 100)
  })

  it('uses the native default y when block.y is falsy and no dimensions are passed', () => {
    const origin = blockOrigin({ phase_id: 'p1', lane_id: 'l1', x: 0, y: 0 }, geometry)
    expect(origin.x).toBe(geometry.phaseX('p1') + BLOCK_DEFAULT_X)
    expect(origin.y).toBe(geometry.laneY('l1') + BLOCK_DEFAULT_Y)
  })

  it('recomputes the default y for a custom (taller) block height when block.y is falsy', () => {
    const origin = blockOrigin({ phase_id: 'p1', lane_id: 'l1', x: 0, y: 0 }, geometry, {
      width: 360,
      height: 200,
    })
    // 200-tall block in 180-tall lane → laneInset clamps to 0 → block sits at lane top
    expect(origin.y).toBe(geometry.laneY('l1') + 0)
  })

  it('preserves native (240×64) placement when explicit native dimensions are passed', () => {
    const origin = blockOrigin({ phase_id: 'p1', lane_id: 'l1', x: 0, y: 0 }, geometry, {
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
    })
    expect(origin.y).toBe(geometry.laneY('l1') + BLOCK_DEFAULT_Y)
  })
})
