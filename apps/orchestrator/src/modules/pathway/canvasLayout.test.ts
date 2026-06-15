import { describe, expect, it } from 'vitest'

import {
  BLOCK_DEFAULT_X,
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  LANE_INSET,
  LANE_ROW_HEIGHT,
  blockOrigin,
  buildCanvasGeometry,
  laneInset,
} from './canvasLayout'

// Native default y for a 64-tall block in a 320-tall lane.
// Inlined here (was `BLOCK_DEFAULT_Y` export, now dead-code-trimmed).
const NATIVE_DEFAULT_Y = LANE_INSET - BLOCK_HEIGHT / 2
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
    // Pre-refactor: NATIVE_DEFAULT_Y = LANE_INSET - BLOCK_HEIGHT/2 = 58 - 32 = 26.
    // The new function must preserve this for the native case.
    expect(laneInset(BLOCK_HEIGHT, LANE_ROW_HEIGHT)).toBe(NATIVE_DEFAULT_Y)
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
    expect(origin.y).toBe(geometry.laneY('l1') + NATIVE_DEFAULT_Y)
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
    expect(origin.y).toBe(geometry.laneY('l1') + NATIVE_DEFAULT_Y)
  })
})

describe('buildCanvasGeometry fit-grow', () => {
  it('grows phase width to contain a block that overflows the declared column', () => {
    const blocks = [{ phase_id: 'p1', lane_id: 'l1', x: 70, y: 0, width: 540, height: 100 }]
    const geometry = buildCanvasGeometry(phases, lanes, blocks)
    // 70 + 540 + 28 padding = 638 > declared 380
    expect(geometry.phaseW('p1')).toBe(638)
  })

  it('grows lane height to contain a tall block', () => {
    const blocks = [{ phase_id: 'p1', lane_id: 'l1', x: 0, y: 30, width: 240, height: 400 }]
    const geometry = buildCanvasGeometry(phases, lanes, blocks)
    // 30 + 400 + 28 padding = 458 > declared LANE_ROW_HEIGHT (320)
    expect(geometry.laneH('l1')).toBe(458)
  })

  it('keeps declared dimensions when blocks fit comfortably', () => {
    const blocks = [{ phase_id: 'p1', lane_id: 'l1', x: 10, y: 10, width: 100, height: 60 }]
    const geometry = buildCanvasGeometry(phases, lanes, blocks)
    expect(geometry.phaseW('p1')).toBe(380)
    expect(geometry.laneH('l1')).toBe(LANE_ROW_HEIGHT)
  })

  it('takes the max across multiple blocks in the same cell', () => {
    const blocks = [
      { phase_id: 'p1', lane_id: 'l1', x: 0, y: 0, width: 240, height: 64 },
      { phase_id: 'p1', lane_id: 'l1', x: 200, y: 100, width: 540, height: 300 },
      { phase_id: 'p1', lane_id: 'l1', x: 50, y: 50, width: 360, height: 200 },
    ]
    const geometry = buildCanvasGeometry(phases, lanes, blocks)
    // widest: 200 + 540 + 28 = 768
    expect(geometry.phaseW('p1')).toBe(768)
    // tallest: 100 + 300 + 28 = 428
    expect(geometry.laneH('l1')).toBe(428)
  })
})
