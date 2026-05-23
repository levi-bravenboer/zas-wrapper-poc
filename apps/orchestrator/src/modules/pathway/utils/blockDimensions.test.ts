import { describe, expect, it } from 'vitest'

import { BLOCK_HEIGHT, BLOCK_WIDTH } from '../canvasLayout'
import {
  LUSCII_PROGRAM_BLOCK_TYPE,
  LUSCII_PROGRAM_KIND,
  LUSCII_PROVIDER,
} from '../components/canvas/nodes/external/luscii/types'
import type { PathwayBlock, PathwayBlockType } from '../types'

import {
  computeLusciiProgramDimensions,
  computeLusciiProgramDimensionsFromCounts,
  getBlockDimensions,
} from './blockDimensions'

function makeBlock(overrides: Partial<PathwayBlock> = {}): PathwayBlock {
  return {
    id: 'b-1',
    phase_id: 'p-1',
    lane_id: 'l-1',
    type: 'appointment',
    label: null,
    duration_value_id: null,
    config: {},
    x: 0,
    y: 0,
    ...overrides,
  } as unknown as PathwayBlock
}

function makeBlockType(overrides: Partial<PathwayBlockType> = {}): PathwayBlockType {
  return {
    type: 'appointment',
    label: 'Appointment',
    semantics: 'appointment',
    icon: 'calendar',
    allowed_lane_kind_codes: ['caregiver'],
    supports_branches: false,
    config_schema: {},
    ui_schema: {},
    ...overrides,
  } as unknown as PathwayBlockType
}

describe('getBlockDimensions', () => {
  it('returns the native default for native blocks', () => {
    const block = makeBlock()
    const blockType = makeBlockType()
    expect(getBlockDimensions(block, blockType)).toEqual({
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
    })
  })

  it('returns the native default when blockType is unknown', () => {
    const block = makeBlock()
    expect(getBlockDimensions(block, null)).toEqual({
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
    })
  })

  it('returns the Luscii minimum dimensions for luscii.program (per-instance size lives in the renderer)', () => {
    const block = makeBlock({ type: LUSCII_PROGRAM_BLOCK_TYPE })
    const blockType = {
      ...makeBlockType({ type: LUSCII_PROGRAM_BLOCK_TYPE }),
      source: 'external',
      provider: LUSCII_PROVIDER,
      kind: LUSCII_PROGRAM_KIND,
    } as unknown as PathwayBlockType
    expect(getBlockDimensions(block, blockType)).toEqual({ width: 360, height: 200 })
  })
})

describe('computeLusciiProgramDimensionsFromCounts', () => {
  it('returns 360×200 for the smallest layout (≤2 phases × ≤2 lanes)', () => {
    expect(computeLusciiProgramDimensionsFromCounts(2, 2)).toEqual({ width: 360, height: 200 })
    expect(computeLusciiProgramDimensionsFromCounts(0, 0)).toEqual({ width: 360, height: 200 })
    expect(computeLusciiProgramDimensionsFromCounts(1, 2)).toEqual({ width: 360, height: 200 })
  })

  it('grows width by 60px per phase beyond 2, height by 50px per lane beyond 2', () => {
    expect(computeLusciiProgramDimensionsFromCounts(4, 3)).toEqual({ width: 480, height: 250 })
    expect(computeLusciiProgramDimensionsFromCounts(3, 4)).toEqual({ width: 420, height: 300 })
  })

  it('clamps to the maximum 540×300 for very dense programs', () => {
    expect(computeLusciiProgramDimensionsFromCounts(6, 5)).toEqual({ width: 540, height: 300 })
    expect(computeLusciiProgramDimensionsFromCounts(10, 10)).toEqual({ width: 540, height: 300 })
  })
})

describe('computeLusciiProgramDimensions', () => {
  it('returns the minimum 360×200 when no resolved program is supplied', () => {
    expect(computeLusciiProgramDimensions(null)).toEqual({ width: 360, height: 200 })
    expect(computeLusciiProgramDimensions(undefined)).toEqual({ width: 360, height: 200 })
    expect(computeLusciiProgramDimensions({})).toEqual({ width: 360, height: 200 })
    expect(computeLusciiProgramDimensions({ layout: null })).toEqual({ width: 360, height: 200 })
  })

  it('delegates to the counts-based computer when a layout is present', () => {
    // Typed minimally — we only read phases.length + lanes.length.
    const layout = {
      phases: Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, ord: i, label: `P${i}` })),
      lanes: Array.from({ length: 3 }, (_, i) => ({
        id: `l${i}`,
        ord: i,
        kind: 'patient' as const,
      })),
    }
    expect(computeLusciiProgramDimensions({ layout })).toEqual({ width: 480, height: 250 })
  })
})
