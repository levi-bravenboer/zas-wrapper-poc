import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PathwayBare, PathwayVersionDefinition } from '../types'

const { mutateMock, hookState } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  hookState: { isPending: false, isError: false },
}))

vi.mock('../hooks', () => ({
  useReplacePathway: () => ({
    mutate: mutateMock,
    get isPending() {
      return hookState.isPending
    },
    get isError() {
      return hookState.isError
    },
  }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { useAutosavePathway } from './useAutosavePathway'

const pathway: PathwayBare = {
  id: 'p-1',
  name: 'X',
  clinical_goal: null,
  patient_goal: null,
} as unknown as PathwayBare

const version: PathwayVersionDefinition = {
  id: 'v-1',
  pathway_id: 'p-1',
  version_no: 1,
  status: 'concept',
  kind: 'initial',
  phases: [],
  lanes: [],
  timing_values: [],
  blocks: [],
  branches: [],
  edges: [],
  time_markers: [],
} as unknown as PathwayVersionDefinition

describe('useAutosavePathway', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mutateMock.mockReset()
    hookState.isPending = false
    hookState.isError = false
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces a save 800ms after isDirty flips true', () => {
    const dispatch = vi.fn()
    renderHook(() => useAutosavePathway({ pathway, version, dispatch, isDirty: true }))
    expect(mutateMock).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(799)
    })
    expect(mutateMock).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(mutateMock).toHaveBeenCalledTimes(1)
  })

  it('does not autosave when not dirty', () => {
    renderHook(() => useAutosavePathway({ pathway, version, dispatch: vi.fn(), isDirty: false }))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(mutateMock).not.toHaveBeenCalled()
  })

  it('flushes pending save on visibility hidden', () => {
    renderHook(() => useAutosavePathway({ pathway, version, dispatch: vi.fn(), isDirty: true }))

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    act(() => {
      window.dispatchEvent(new Event('visibilitychange'))
    })

    expect(mutateMock).toHaveBeenCalledTimes(1)
  })

  it('reports saveState transitions clean → dirty → saving → error', () => {
    const { result, rerender } = renderHook(
      ({ isDirty, pending, error }: { isDirty: boolean; pending: boolean; error: boolean }) => {
        hookState.isPending = pending
        hookState.isError = error
        return useAutosavePathway({ pathway, version, dispatch: vi.fn(), isDirty })
      },
      { initialProps: { isDirty: false, pending: false, error: false } },
    )
    expect(result.current.saveState).toBe('clean')

    rerender({ isDirty: true, pending: false, error: false })
    expect(result.current.saveState).toBe('dirty')

    rerender({ isDirty: true, pending: true, error: false })
    expect(result.current.saveState).toBe('saving')

    rerender({ isDirty: false, pending: false, error: true })
    expect(result.current.saveState).toBe('error')
  })

  it('does not retry the same version after a failed save', () => {
    mutateMock.mockImplementation((_payload, opts) => opts?.onError?.())
    const { rerender } = renderHook(
      ({ v }: { v: PathwayVersionDefinition }) =>
        useAutosavePathway({ pathway, version: v, dispatch: vi.fn(), isDirty: true }),
      { initialProps: { v: version } },
    )

    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(mutateMock).toHaveBeenCalledTimes(1)

    rerender({ v: version })
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(mutateMock).toHaveBeenCalledTimes(1)

    const nextVersion = { ...version } as PathwayVersionDefinition
    rerender({ v: nextVersion })
    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(mutateMock).toHaveBeenCalledTimes(2)
  })
})
