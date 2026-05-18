import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useTableExpansion } from './use-table-expansion'

describe('useTableExpansion', () => {
  it('starts with no expansion', () => {
    const { result } = renderHook(() => useTableExpansion())
    expect(result.current.expandedId).toBeNull()
  })

  it('toggle sets the id', () => {
    const { result } = renderHook(() => useTableExpansion())
    act(() => result.current.toggle('row-1'))
    expect(result.current.expandedId).toBe('row-1')
  })

  it('toggle same id collapses', () => {
    const { result } = renderHook(() => useTableExpansion())
    act(() => result.current.toggle('row-1'))
    act(() => result.current.toggle('row-1'))
    expect(result.current.expandedId).toBeNull()
  })

  it('toggle different id switches (single-row expansion)', () => {
    const { result } = renderHook(() => useTableExpansion())
    act(() => result.current.toggle('row-1'))
    act(() => result.current.toggle('row-2'))
    expect(result.current.expandedId).toBe('row-2')
  })
})
