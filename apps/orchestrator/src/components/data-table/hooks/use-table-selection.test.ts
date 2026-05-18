import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useTableSelection } from './use-table-selection'

interface Row {
  id: string
}

const page1: Row[] = [{ id: 'a' }, { id: 'b' }]
const page2: Row[] = [{ id: 'c' }, { id: 'd' }]

const getRowId = (r: Row) => r.id

describe('useTableSelection', () => {
  it('internal mode — toggleRow updates state', () => {
    const { result } = renderHook(() =>
      useTableSelection({
        data: page1,
        getRowId,
        selectable: true,
        page: 1,
        filterIdentity: 'k1',
      }),
    )
    act(() => result.current.toggleRow('a'))
    expect(Array.from(result.current.selectedIds).sort()).toEqual(['a'])
  })

  it('controlled mode — calls onSelectionChange, never mutates local', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useTableSelection({
        data: page1,
        getRowId,
        selectable: true,
        page: 1,
        filterIdentity: 'k1',
        controlled: { selectedIds: new Set<string>(), onSelectionChange: onChange },
      }),
    )
    act(() => result.current.toggleRow('a'))
    expect(onChange).toHaveBeenCalledWith(new Set(['a']))
  })

  it('togglePage selects all current page rows', () => {
    const { result } = renderHook(() =>
      useTableSelection({
        data: page1,
        getRowId,
        selectable: true,
        page: 1,
        filterIdentity: 'k1',
      }),
    )
    act(() => result.current.togglePage())
    expect(Array.from(result.current.selectedIds).sort()).toEqual(['a', 'b'])
  })

  it('togglePage deselects when all current rows are already selected', () => {
    const { result } = renderHook(() =>
      useTableSelection({
        data: page1,
        getRowId,
        selectable: true,
        page: 1,
        filterIdentity: 'k1',
      }),
    )
    act(() => result.current.togglePage())
    act(() => result.current.togglePage())
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('pageSelectionState reflects partial selection', () => {
    const { result } = renderHook(() =>
      useTableSelection({
        data: page1,
        getRowId,
        selectable: true,
        page: 1,
        filterIdentity: 'k1',
      }),
    )
    act(() => result.current.toggleRow('a'))
    expect(result.current.pageSelectionState).toBe('some')
  })

  it('cross-page persistence — selecting on p1, navigating to p2, ids remain', () => {
    const { result, rerender } = renderHook(
      ({ data, page }: { data: Row[]; page: number }) =>
        useTableSelection({ data, getRowId, selectable: true, page, filterIdentity: 'k1' }),
      { initialProps: { data: page1, page: 1 } },
    )
    act(() => result.current.toggleRow('a'))
    rerender({ data: page2, page: 2 })
    expect(result.current.selectedIds.has('a')).toBe(true)
  })

  it('page-reconcile — current-page id disappears on refetch → dropped', () => {
    const { result, rerender } = renderHook(
      ({ data }: { data: Row[] }) =>
        useTableSelection({ data, getRowId, selectable: true, page: 1, filterIdentity: 'k1' }),
      { initialProps: { data: page1 } },
    )
    act(() => result.current.toggleRow('a'))
    rerender({ data: [{ id: 'b' }] })
    expect(result.current.selectedIds.has('a')).toBe(false)
  })

  it('filter-identity change clears selection', () => {
    const { result, rerender } = renderHook(
      ({ filterIdentity }: { filterIdentity: string }) =>
        useTableSelection({
          data: page1,
          getRowId,
          selectable: true,
          page: 1,
          filterIdentity,
        }),
      { initialProps: { filterIdentity: 'k1' } },
    )
    act(() => result.current.toggleRow('a'))
    rerender({ filterIdentity: 'k2' })
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('cancel clears selection', () => {
    const { result } = renderHook(() =>
      useTableSelection({
        data: page1,
        getRowId,
        selectable: true,
        page: 1,
        filterIdentity: 'k1',
      }),
    )
    act(() => result.current.toggleRow('a'))
    act(() => result.current.cancel())
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('no-ops when selectable=false', () => {
    const { result } = renderHook(() =>
      useTableSelection({
        data: page1,
        getRowId,
        selectable: false,
        page: 1,
        filterIdentity: 'k1',
      }),
    )
    expect(result.current.pageSelectionState).toBe('none')
  })
})
