import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DATA_TABLE_DEFAULT_STATE } from './use-data-table-state'
import { parseStoredState, storageKeyFor, useLocalTableState } from './use-local-table-state'

describe('parseStoredState', () => {
  it('returns null for nullish or malformed input', () => {
    expect(parseStoredState(null)).toBeNull()
    expect(parseStoredState('not-json')).toBeNull()
    expect(parseStoredState('[]')).toBeNull()
  })

  it('keeps recognised primitive fields and drops the rest', () => {
    const out = parseStoredState(
      JSON.stringify({
        page: 5,
        pageSize: 50,
        q: 'hello',
        orderBy: 'name',
        order: 'desc',
        nope: 'ignored',
      }),
    )
    expect(out).toEqual({
      page: 5,
      pageSize: 50,
      q: 'hello',
      orderBy: 'name',
      order: 'desc',
    })
  })

  it('parses filter records', () => {
    const out = parseStoredState(
      JSON.stringify({
        filters: {
          status: { op: 'eq', value: 'active' },
          ids: [{ op: 'in', value: ['a', 'b'] }],
          bad: { op: 'nope', value: 'x' },
        },
      }),
    )
    expect(out?.filters).toEqual({
      status: { op: 'eq', value: 'active' },
      ids: [{ op: 'in', value: ['a', 'b'] }],
    })
  })
})

describe('useLocalTableState', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
  })

  it('hydrates from defaults when storage is empty', () => {
    const { result } = renderHook(() => useLocalTableState('demo'))
    expect(result.current[0]).toEqual(DATA_TABLE_DEFAULT_STATE)
  })

  it('hydrates from initial when storage is empty', () => {
    const { result } = renderHook(() => useLocalTableState('demo', { pageSize: 50 }))
    expect(result.current[0].pageSize).toBe(50)
  })

  it('hydrates from localStorage in preference to initial', () => {
    window.localStorage.setItem(storageKeyFor('demo'), JSON.stringify({ page: 2, pageSize: 100 }))
    const { result } = renderHook(() => useLocalTableState('demo', { pageSize: 50 }))
    expect(result.current[0].pageSize).toBe(100)
    expect(result.current[0].page).toBe(2)
  })

  it('debounces writes by 200ms', () => {
    const { result } = renderHook(() => useLocalTableState('demo'))
    act(() => {
      result.current[1].setPage(2)
    })
    // Effect schedules a 200ms write — nothing yet.
    expect(window.localStorage.getItem(storageKeyFor('demo'))).toBeNull()

    act(() => {
      vi.advanceTimersByTime(199)
    })
    expect(window.localStorage.getItem(storageKeyFor('demo'))).toBeNull()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    const stored = window.localStorage.getItem(storageKeyFor('demo'))
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored ?? '{}')).toMatchObject({ page: 2 })
  })

  it('collapses rapid updates into a single write', () => {
    const setSpy = vi.spyOn(window.localStorage, 'setItem')
    const { result } = renderHook(() => useLocalTableState('demo'))
    act(() => {
      result.current[1].setSearch('a')
    })
    act(() => {
      result.current[1].setSearch('ab')
    })
    act(() => {
      result.current[1].setSearch('abc')
    })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    const matching = setSpy.mock.calls.filter(([key]) => key === storageKeyFor('demo'))
    expect(matching).toHaveLength(1)
    expect(JSON.parse(matching[0]?.[1] as string)).toMatchObject({ q: 'abc' })
  })
})
