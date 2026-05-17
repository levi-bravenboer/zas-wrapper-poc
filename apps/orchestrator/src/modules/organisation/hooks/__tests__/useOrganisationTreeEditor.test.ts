import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useOrganisationTreeEditor } from '../useOrganisationTreeEditor'

const move = (id: string, parent: string | null, sort: number) => ({
  id,
  parent_organisation_id: parent,
  sort_index: sort,
})

describe('useOrganisationTreeEditor', () => {
  it('starts in read mode with no pending moves', () => {
    const { result } = renderHook(() => useOrganisationTreeEditor())
    expect(result.current.mode).toBe('read')
    expect(result.current.pendingMoves.size).toBe(0)
  })

  it('enterEdit + exitEdit toggle mode and clear staged moves on exit', () => {
    const { result } = renderHook(() => useOrganisationTreeEditor())
    act(() => result.current.enterEdit())
    expect(result.current.mode).toBe('edit')
    act(() => result.current.moveNode(move('a', null, 1)))
    expect(result.current.pendingMoves.size).toBe(1)
    act(() => result.current.exitEdit())
    expect(result.current.mode).toBe('read')
    expect(result.current.pendingMoves.size).toBe(0)
  })

  it('moveNode upserts by id so the latest position wins', () => {
    const { result } = renderHook(() => useOrganisationTreeEditor())
    act(() => result.current.enterEdit())
    act(() => result.current.moveNode(move('a', null, 0)))
    act(() => result.current.moveNode(move('a', 'b', 5)))
    expect(result.current.pendingMoves.size).toBe(1)
    expect(result.current.pendingMoves.get('a')).toEqual(move('a', 'b', 5))
  })

  it('toggleExpand flips membership', () => {
    const { result } = renderHook(() => useOrganisationTreeEditor(['a']))
    expect(result.current.expanded.has('a')).toBe(true)
    act(() => result.current.toggleExpand('a'))
    expect(result.current.expanded.has('a')).toBe(false)
    act(() => result.current.toggleExpand('a'))
    expect(result.current.expanded.has('a')).toBe(true)
  })

  it('reset clears mode + pending but preserves expanded', () => {
    const { result } = renderHook(() => useOrganisationTreeEditor(['a']))
    act(() => result.current.enterEdit())
    act(() => result.current.moveNode(move('x', null, 0)))
    act(() => result.current.reset())
    expect(result.current.mode).toBe('read')
    expect(result.current.pendingMoves.size).toBe(0)
    expect(result.current.expanded.has('a')).toBe(true)
  })
})
