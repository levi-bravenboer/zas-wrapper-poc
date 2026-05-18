import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DebouncedSearch } from './DebouncedSearch'

describe('DebouncedSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits debounced value after 300ms', () => {
    const onChange = vi.fn()
    render(<DebouncedSearch value={null} onChange={onChange} placeholder="Search" />)
    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'foo' } })
    expect(onChange).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onChange).toHaveBeenLastCalledWith('foo')
  })

  it('emits null when cleared to empty', () => {
    const onChange = vi.fn()
    render(<DebouncedSearch value="x" onChange={onChange} placeholder="Search" />)
    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: '' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})
