import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  DATA_TABLE_DEFAULT_STATE,
  dataTableReducer,
  mergeInitialState,
  useDataTableState,
  type DataTableState,
} from './use-data-table-state'

describe('mergeInitialState', () => {
  it('returns the defaults when no initial state is provided', () => {
    expect(mergeInitialState()).toEqual(DATA_TABLE_DEFAULT_STATE)
  })

  it('shallow-merges caller overrides over the defaults', () => {
    const merged = mergeInitialState({ pageSize: 50, filters: { status: { op: 'eq', value: 'a' } } })
    expect(merged.pageSize).toBe(50)
    expect(merged.page).toBe(1)
    expect(merged.filters).toEqual({ status: { op: 'eq', value: 'a' } })
  })
})

describe('dataTableReducer', () => {
  const base: DataTableState = { ...DATA_TABLE_DEFAULT_STATE, page: 3 }

  it('updates page', () => {
    expect(dataTableReducer(base, { type: 'setPage', page: 7 }).page).toBe(7)
  })

  it('returns the same reference when setting an unchanged page', () => {
    expect(dataTableReducer(base, { type: 'setPage', page: 3 })).toBe(base)
  })

  it('resets to page 1 when changing page size', () => {
    const next = dataTableReducer(base, { type: 'setPageSize', pageSize: 50 })
    expect(next.pageSize).toBe(50)
    expect(next.page).toBe(1)
  })

  it('resets page when search changes', () => {
    const next = dataTableReducer(base, { type: 'setSearch', q: 'hello' })
    expect(next.q).toBe('hello')
    expect(next.page).toBe(1)
  })

  it('sets and clears sort', () => {
    const sorted = dataTableReducer(base, { type: 'setSort', orderBy: 'name', order: 'desc' })
    expect(sorted.orderBy).toBe('name')
    expect(sorted.order).toBe('desc')
    const cleared = dataTableReducer(sorted, { type: 'clearSort' })
    expect(cleared.orderBy).toBeNull()
    expect(cleared.order).toBe('asc')
  })

  it('sets and clears filters and resets page', () => {
    const filtered = dataTableReducer(base, {
      type: 'setFilter',
      field: 'status',
      filter: { op: 'eq', value: 'active' },
    })
    expect(filtered.filters['status']).toEqual({ op: 'eq', value: 'active' })
    expect(filtered.page).toBe(1)

    const cleared = dataTableReducer(filtered, { type: 'clearFilter', field: 'status' })
    expect(cleared.filters['status']).toBeUndefined()
  })

  it('clearAll preserves page size but otherwise resets', () => {
    const start: DataTableState = {
      page: 5,
      pageSize: 100,
      q: 'foo',
      orderBy: 'name',
      order: 'desc',
      filters: { status: { op: 'eq', value: 'active' } },
    }
    const next = dataTableReducer(start, { type: 'clearAll' })
    expect(next).toEqual({ ...DATA_TABLE_DEFAULT_STATE, pageSize: 100 })
  })

  it('reset returns to defaults merged with new initial', () => {
    const start: DataTableState = { ...DATA_TABLE_DEFAULT_STATE, page: 9 }
    const next = dataTableReducer(start, { type: 'reset', initial: { pageSize: 50 } })
    expect(next).toEqual({ ...DATA_TABLE_DEFAULT_STATE, pageSize: 50 })
  })
})

describe('useDataTableState', () => {
  it('exposes a stable dispatch surface that mutates state', () => {
    const { result } = renderHook(() => useDataTableState({ pageSize: 50 }))

    expect(result.current[0]).toEqual({ ...DATA_TABLE_DEFAULT_STATE, pageSize: 50 })

    act(() => {
      result.current[1].setPage(3)
    })
    expect(result.current[0].page).toBe(3)

    act(() => {
      result.current[1].setSearch('hello')
    })
    expect(result.current[0].q).toBe('hello')
    expect(result.current[0].page).toBe(1)

    act(() => {
      result.current[1].setSort('name', 'desc')
    })
    expect(result.current[0].orderBy).toBe('name')
    expect(result.current[0].order).toBe('desc')

    act(() => {
      result.current[1].setFilter('status', { op: 'eq', value: 'active' })
    })
    expect(result.current[0].filters['status']).toEqual({ op: 'eq', value: 'active' })

    act(() => {
      result.current[1].clearFilter('status')
    })
    expect(result.current[0].filters['status']).toBeUndefined()

    act(() => {
      result.current[1].clearSort()
    })
    expect(result.current[0].orderBy).toBeNull()

    act(() => {
      result.current[1].clearAll()
    })
    expect(result.current[0]).toEqual({ ...DATA_TABLE_DEFAULT_STATE, pageSize: 50 })

    act(() => {
      result.current[1].reset({ page: 4 })
    })
    expect(result.current[0]).toEqual({ ...DATA_TABLE_DEFAULT_STATE, page: 4 })

    act(() => {
      result.current[1].reset()
    })
    expect(result.current[0]).toEqual(DATA_TABLE_DEFAULT_STATE)
  })
})
