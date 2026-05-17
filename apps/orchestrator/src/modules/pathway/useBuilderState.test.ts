import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { PathwayEdge, PathwayVersionDefinition } from './types'
import { useBuilderState } from './useBuilderState'

const E1: PathwayEdge = {
  id: 'edge-1',
  source_block_id: 'block-1',
  target_block_id: 'block-2',
  source_branch_id: null,
  delay_value_id: 'value-1',
  time_marker_id: null,
  offset_value_id: null,
  offset_direction_code: null,
}

const E2: PathwayEdge = {
  id: 'edge-2',
  source_block_id: 'block-2',
  target_block_id: 'block-3',
  source_branch_id: null,
  delay_value_id: null,
  time_marker_id: null,
  offset_value_id: null,
  offset_direction_code: null,
}

function makeVersion(): PathwayVersionDefinition {
  return {
    id: 'v-1',
    pathway_id: 'p-1',
    version_no: 1,
    status: 'concept',
    kind: 'initial',
    label: null,
    note: null,
    derived_from_version_id: null,
    published_at: null,
    published_by: null,
    updated_at: '2026-05-17T00:00:00Z',
    phases: [],
    lanes: [
      {
        id: 'lane-1',
        pathway_lane_kind_id: 'kind-1',
        lane_kind_code: 'patient',
        label: 'Patiënt',
        ord: 10,
        is_default: true,
      },
    ],
    timing_values: [],
    blocks: [],
    branches: [],
    edges: [E1, E2],
    time_markers: [],
  } as unknown as PathwayVersionDefinition
}

describe('useBuilderState — patch-edge', () => {
  it('updates the matching edge and pushes history', () => {
    const { result } = renderHook(() => useBuilderState(makeVersion()))
    expect(result.current.state.history.past.length).toBe(0)

    act(() => {
      result.current.dispatch({
        type: 'patch-edge',
        edgeId: 'edge-1',
        patch: {
          delay_value_id: null,
          time_marker_id: 'marker-1',
          offset_value_id: 'value-2',
          offset_direction_code: 'before',
        },
      })
    })

    const edges = result.current.state.version.edges ?? []
    const patched = edges.find((e) => e.id === 'edge-1')
    const untouched = edges.find((e) => e.id === 'edge-2')
    expect(patched?.delay_value_id).toBeNull()
    expect(patched?.time_marker_id).toBe('marker-1')
    expect(patched?.offset_value_id).toBe('value-2')
    expect(patched?.offset_direction_code).toBe('before')
    expect(untouched).toEqual(E2)
    expect(result.current.state.history.past.length).toBe(1)
  })

  it('undo restores the pre-patch edge', () => {
    const { result } = renderHook(() => useBuilderState(makeVersion()))

    act(() => {
      result.current.dispatch({
        type: 'patch-edge',
        edgeId: 'edge-1',
        patch: { delay_value_id: null, source_branch_id: 'branch-9' },
      })
    })
    act(() => {
      result.current.dispatch({ type: 'undo' })
    })

    const edges = result.current.state.version.edges ?? []
    expect(edges.find((e) => e.id === 'edge-1')).toEqual(E1)
    expect(result.current.state.history.future.length).toBe(1)
  })
})
