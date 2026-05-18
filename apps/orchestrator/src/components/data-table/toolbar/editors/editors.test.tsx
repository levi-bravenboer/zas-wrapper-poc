import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import { DateRangeEditor, MultiEditor, SelectEditor, TextEditor } from './'

const selectDef = {
  type: 'select' as const,
  key: 'role',
  label: 'Role',
  options: [
    { value: 'admin', label: 'Admin' },
    { value: 'caregiver', label: 'Caregiver' },
  ],
}

describe('SelectEditor', () => {
  it('emits { op: eq, value }', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <SelectEditor def={selectDef} current={undefined} onChange={onChange} />,
    )
    await user.click(await screen.findByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Admin' }))
    expect(onChange).toHaveBeenCalledWith('role', { op: 'eq', value: 'admin' })
  })
})

describe('MultiEditor', () => {
  const def = {
    type: 'multi' as const,
    key: 'tag',
    label: 'Tag',
    options: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ],
  }

  it('adds value when toggled on', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MultiEditor def={def} current={undefined} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'A' }))
    expect(onChange).toHaveBeenLastCalledWith('tag', { op: 'in', value: ['a'] })
  })

  it('emits null when last selected value is toggled off', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MultiEditor def={def} current={{ op: 'in', value: ['a'] }} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'A' }))
    expect(onChange).toHaveBeenLastCalledWith('tag', null)
  })
})

describe('DateRangeEditor', () => {
  it('emits gte when from-date typed', async () => {
    const def = { type: 'date-range' as const, key: 'created', label: 'Created' }
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<DateRangeEditor def={def} current={undefined} onChange={onChange} />)
    const inputs = screen.getAllByDisplayValue('')
    await user.type(inputs[0]!, '2025-01-01')
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)).toEqual(['created', { op: 'gte', value: '2025-01-01' }])
  })
})

describe('TextEditor', () => {
  it('emits { op: contains } on input, null on clear', async () => {
    const def = { type: 'text' as const, key: 'q', label: 'Q' }
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TextEditor def={def} current={undefined} onChange={onChange} />)
    const input = screen.getByPlaceholderText('Q')
    await user.type(input, 'h')
    expect(onChange).toHaveBeenLastCalledWith('q', { op: 'contains', value: 'h' })
    // Re-render with the typed value so `clear` actually clears something
    render(<TextEditor def={def} current={{ op: 'contains', value: 'h' }} onChange={onChange} />)
    const inputs = screen.getAllByPlaceholderText('Q')
    await user.clear(inputs[1]!)
    expect(onChange).toHaveBeenLastCalledWith('q', null)
  })
})
