import { act, fireEvent, render, screen } from '@testing-library/react'
import * as React from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { DataTableToolbar } from './DataTableToolbar'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

/**
 * Search input uses a 300ms debounce. We use fake timers to verify that:
 *   - typing multiple characters within the debounce window collapses to ONE emit
 *   - clearing the input emits `null` (whitespace-only also normalises to null)
 */
describe('DataTableToolbar.Search (debounced 300ms)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('collapses rapid keystrokes within 300ms into a single emit', () => {
    const onSearchChange = vi.fn()

    renderWithI18n(
      <DataTableToolbar
        q={null}
        filters={{}}
        onSearchChange={onSearchChange}
        onFilterChange={vi.fn()}
        onClearFilters={vi.fn()}
      />,
    )

    const input = screen.getByRole('searchbox')

    // Simulate three keystrokes well inside the 300ms window.
    fireEvent.change(input, { target: { value: 'a' } })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    fireEvent.change(input, { target: { value: 'ab' } })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    fireEvent.change(input, { target: { value: 'abc' } })

    // Still inside the debounce window for the last keystroke → no emit yet.
    expect(onSearchChange).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(onSearchChange).toHaveBeenCalledTimes(1)
    expect(onSearchChange).toHaveBeenCalledWith('abc')
  })

  it('emits separately when keystrokes are spaced beyond the debounce window', () => {
    const onSearchChange = vi.fn()

    renderWithI18n(
      <DataTableToolbar
        q={null}
        filters={{}}
        onSearchChange={onSearchChange}
        onFilterChange={vi.fn()}
        onClearFilters={vi.fn()}
      />,
    )

    const input = screen.getByRole('searchbox')

    fireEvent.change(input, { target: { value: 'a' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    fireEvent.change(input, { target: { value: 'ab' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(onSearchChange).toHaveBeenCalledTimes(2)
    expect(onSearchChange).toHaveBeenNthCalledWith(1, 'a')
    expect(onSearchChange).toHaveBeenNthCalledWith(2, 'ab')
  })

  it('emits null when the input is cleared', () => {
    const onSearchChange = vi.fn()

    renderWithI18n(
      <DataTableToolbar
        q="abc"
        filters={{}}
        onSearchChange={onSearchChange}
        onFilterChange={vi.fn()}
        onClearFilters={vi.fn()}
      />,
    )

    const input = screen.getByRole('searchbox') as HTMLInputElement
    expect(input.value).toBe('abc')

    fireEvent.change(input, { target: { value: '' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(onSearchChange).toHaveBeenCalledTimes(1)
    expect(onSearchChange).toHaveBeenCalledWith(null)
  })

  it('normalises whitespace-only input to null', () => {
    const onSearchChange = vi.fn()

    renderWithI18n(
      <DataTableToolbar
        q={null}
        filters={{}}
        onSearchChange={onSearchChange}
        onFilterChange={vi.fn()}
        onClearFilters={vi.fn()}
      />,
    )

    const input = screen.getByRole('searchbox')

    fireEvent.change(input, { target: { value: '   ' } })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(onSearchChange).toHaveBeenCalledTimes(1)
    expect(onSearchChange).toHaveBeenCalledWith(null)
  })
})
