import { describe, expect, it } from 'vitest'

import { BLOCK_HEIGHT, BLOCK_WIDTH } from '../canvasLayout'
import type { PathwayBlock, PathwayBlockType } from '../types'

import { getBlockDimensions } from './blockDimensions'

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

  it('falls back to native dims for external blocks until a per-provider size computer registers', () => {
    const block = makeBlock({ type: 'luscii.program' })
    // reason: forward-looking shape; the source/provider/kind fields land via
    // openapi-sync once external-block-integrations migrates the catalogue.
    const blockType = {
      ...makeBlockType({ type: 'luscii.program' }),
      source: 'external',
      provider: 'luscii',
      kind: 'program',
    } as unknown as PathwayBlockType
    expect(getBlockDimensions(block, blockType)).toEqual({
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
    })
  })
})
