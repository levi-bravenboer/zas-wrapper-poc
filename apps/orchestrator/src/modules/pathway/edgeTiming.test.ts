import { describe, expect, it } from 'vitest'

import { readEdgeTiming, type PathwayEdge } from './types'

function makeEdge(overrides: Partial<PathwayEdge>): PathwayEdge {
  return {
    id: 'edge-1',
    source_block_id: 'block-a',
    target_block_id: 'block-b',
    source_branch_id: null,
    delay_value_id: null,
    time_marker_id: null,
    offset_value_id: null,
    offset_direction_code: null,
    ...overrides,
  }
}

describe('readEdgeTiming', () => {
  it('reads completion timing when only delay_value_id is set', () => {
    const timing = readEdgeTiming(makeEdge({ delay_value_id: 'tv-1' }))
    expect(timing).toEqual({ kind: 'completion', delay_value_id: 'tv-1' })
  })

  it('reads branch timing when source_branch_id is set', () => {
    const timing = readEdgeTiming(makeEdge({ source_branch_id: 'br-1' }))
    expect(timing).toEqual({ kind: 'branch', source_branch_id: 'br-1' })
  })

  it('reads immediate timing when nothing is set', () => {
    expect(readEdgeTiming(makeEdge({}))).toEqual({ kind: 'immediate' })
  })

  it('reads marker timing when triple is set', () => {
    const timing = readEdgeTiming(
      makeEdge({
        time_marker_id: 'tm-1',
        offset_value_id: 'tv-1',
        offset_direction_code: 'before',
      }),
    )
    expect(timing).toEqual({
      kind: 'marker',
      time_marker_id: 'tm-1',
      offset_value_id: 'tv-1',
      offset_direction_code: 'before',
    })
  })

  it('round-trips marker timing: edge → timing → edge fields unchanged', () => {
    const edge = makeEdge({
      time_marker_id: 'tm-1',
      offset_value_id: 'tv-1',
      offset_direction_code: 'after',
    })
    const timing = readEdgeTiming(edge)
    if (timing.kind !== 'marker') throw new Error('expected marker timing')
    const rebuilt = makeEdge({
      time_marker_id: timing.time_marker_id,
      offset_value_id: timing.offset_value_id,
      offset_direction_code: timing.offset_direction_code,
    })
    expect(rebuilt).toEqual(edge)
  })
})
