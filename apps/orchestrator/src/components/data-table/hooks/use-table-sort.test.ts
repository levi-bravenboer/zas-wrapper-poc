import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useTableSort } from './use-table-sort'

describe('useTableSort', () => {
  it('first click on a column → asc', () => {
    const setSort = vi.fn()
    const { result } = renderHook(() =>
      useTableSort({ state: { orderBy: null, order: 'asc' }, setSort }),
    )
    act(() => result.current.cycle('name'))
    expect(setSort).toHaveBeenCalledWith('name', 'asc')
  })

  it('second click on same column → desc', () => {
    const setSort = vi.fn()
    const { result } = renderHook(() =>
      useTableSort({ state: { orderBy: 'name', order: 'asc' }, setSort }),
    )
    act(() => result.current.cycle('name'))
    expect(setSort).toHaveBeenCalledWith('name', 'desc')
  })

  it('third click on same column → unset', () => {
    const setSort = vi.fn()
    const { result } = renderHook(() =>
      useTableSort({ state: { orderBy: 'name', order: 'desc' }, setSort }),
    )
    act(() => result.current.cycle('name'))
    expect(setSort).toHaveBeenCalledWith(null, 'asc')
  })

  it('iconState returns active dir for current column, null otherwise', () => {
    const setSort = vi.fn()
    const { result } = renderHook(() =>
      useTableSort({ state: { orderBy: 'name', order: 'desc' }, setSort }),
    )
    expect(result.current.iconState('name')).toBe('desc')
    expect(result.current.iconState('email')).toBeNull()
  })

  it('ariaSort returns proper a11y value', () => {
    const setSort = vi.fn()
    const { result } = renderHook(() =>
      useTableSort({ state: { orderBy: 'name', order: 'asc' }, setSort }),
    )
    expect(result.current.ariaSort('name')).toBe('ascending')
    expect(result.current.ariaSort('email')).toBe('none')
  })
})
