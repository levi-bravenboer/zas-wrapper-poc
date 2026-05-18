import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PathwayBare, PathwayVersionDefinition, PathwayWithVersion } from '../types'

const { pathwayState, versionState } = vi.hoisted(() => ({
  pathwayState: {
    isLoading: false,
    isError: false,
    data: undefined as PathwayWithVersion | undefined,
    error: undefined as unknown,
    refetch: vi.fn(),
  },
  versionState: {
    isLoading: false,
    isError: false,
    data: undefined as PathwayVersionDefinition | undefined,
    error: undefined as unknown,
    refetch: vi.fn(),
  },
}))

vi.mock('../hooks', () => ({
  usePathway: () => pathwayState,
  usePathwayVersion: () => versionState,
}))

import { useResolvedVersion } from './useResolvedVersion'

const pathway: PathwayBare = { id: 'p-1', name: 'X' } as unknown as PathwayBare

function makeVersion(
  status: 'concept' | 'published',
  overrides: Partial<PathwayVersionDefinition> = {},
): PathwayVersionDefinition {
  return {
    id: 'v-1',
    pathway_id: 'p-1',
    version_no: 1,
    status,
    kind: 'initial',
    phases: [],
    lanes: [],
    timing_values: [],
    blocks: [],
    branches: [],
    edges: [],
    time_markers: [],
    ...overrides,
  } as unknown as PathwayVersionDefinition
}

afterEach(() => {
  pathwayState.isLoading = false
  pathwayState.isError = false
  pathwayState.data = undefined
  pathwayState.error = undefined
  versionState.isLoading = false
  versionState.isError = false
  versionState.data = undefined
  versionState.error = undefined
})

describe('useResolvedVersion', () => {
  function assertReady<T extends { status: string }>(
    state: T,
  ): asserts state is T & { status: 'ready' } {
    if (state.status !== 'ready') {
      throw new Error(`expected ready, got ${state.status}`)
    }
  }

  it('bare URL on concept → not read-only', () => {
    pathwayState.data = { pathway, version: makeVersion('concept') }
    const { result } = renderHook(() => useResolvedVersion('p-1', undefined))
    assertReady(result.current)
    expect(result.current.isReadOnly).toBe(false)
    expect(result.current.readOnlyVariant).toBeNull()
  })

  it('bare URL on published-fallback → read-only published-fallback', () => {
    pathwayState.data = { pathway, version: makeVersion('published') }
    const { result } = renderHook(() => useResolvedVersion('p-1', undefined))
    assertReady(result.current)
    expect(result.current.isReadOnly).toBe(true)
    expect(result.current.readOnlyVariant).toBe('published-fallback')
  })

  it('/v/$versionId always → read-only historical', () => {
    pathwayState.data = { pathway, version: makeVersion('concept') }
    versionState.data = makeVersion('published', { id: 'v-2', version_no: 2 })
    const { result } = renderHook(() => useResolvedVersion('p-1', 'v-2'))
    assertReady(result.current)
    expect(result.current.version.id).toBe('v-2')
    expect(result.current.isReadOnly).toBe(true)
    expect(result.current.readOnlyVariant).toBe('historical')
  })

  it('pathway loading → loading state', () => {
    pathwayState.isLoading = true
    const { result } = renderHook(() => useResolvedVersion('p-1', undefined))
    expect(result.current.status).toBe('loading')
  })

  it('pathway 404 → not-found', () => {
    pathwayState.isError = true
    pathwayState.error = Object.assign(new Error('nf'), { status: 404 })
    const { result } = renderHook(() => useResolvedVersion('p-1', undefined))
    expect(result.current.status).toBe('not-found')
  })
})
