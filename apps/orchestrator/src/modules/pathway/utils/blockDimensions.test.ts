import { describe, expect, it } from 'vitest'

import { BLOCK_HEIGHT, BLOCK_WIDTH } from '../canvasLayout'
import type { PathwayBlock, PathwayBlockType } from '../types'

import { computeLusciiProgramDimensions, getBlockDimensions } from './blockDimensions'

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
    const block = makeBlock({ type: 'luscii.program' })
    const blockType = {
      ...makeBlockType({ type: 'luscii.program' }),
      source: 'external',
      provider: 'luscii',
      kind: 'program',
    } as unknown as PathwayBlockType
    expect(getBlockDimensions(block, blockType)).toEqual({ width: 360, height: 200 })
  })
})

describe('computeLusciiProgramDimensions', () => {
  it('returns the minimum 360×200 when no resolved program is supplied', () => {
    expect(computeLusciiProgramDimensions(null)).toEqual({ width: 360, height: 200 })
    expect(computeLusciiProgramDimensions(undefined)).toEqual({ width: 360, height: 200 })
    expect(computeLusciiProgramDimensions({})).toEqual({ width: 360, height: 200 })
    expect(computeLusciiProgramDimensions({ layout: null })).toEqual({ width: 360, height: 200 })
  })

  it('returns 360×200 for the smallest layout (≤2 phases × ≤2 lanes)', () => {
    expect(
      computeLusciiProgramDimensions({
        layout: { phases: [{}, {}], lanes: [{}, {}] },
      }),
    ).toEqual({ width: 360, height: 200 })
  })

  it('grows width by 60px per phase beyond 2, height by 50px per lane beyond 2', () => {
    expect(
      computeLusciiProgramDimensions({
        layout: { phases: [{}, {}, {}, {}], lanes: [{}, {}, {}] },
      }),
    ).toEqual({ width: 480, height: 250 })
  })

  it('clamps to the maximum 540×300 for very dense programs', () => {
    expect(
      computeLusciiProgramDimensions({
        layout: {
          phases: [{}, {}, {}, {}, {}, {}],
          lanes: [{}, {}, {}, {}, {}],
        },
      }),
    ).toEqual({ width: 540, height: 300 })
  })

  it('handles partial layouts (missing phases or lanes)', () => {
    expect(
      computeLusciiProgramDimensions({ layout: { phases: [{}, {}, {}] } }),
    ).toEqual({ width: 420, height: 200 })
    expect(
      computeLusciiProgramDimensions({ layout: { lanes: [{}, {}, {}, {}] } }),
    ).toEqual({ width: 360, height: 300 })
  })
})
