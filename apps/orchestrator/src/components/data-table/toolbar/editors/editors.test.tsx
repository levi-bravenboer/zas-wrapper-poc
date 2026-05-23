import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { DataTableFilter } from '../Toolbar'

import { DateRangeEditor, TextEditor } from './'

describe('DateRangeEditor', () => {
  it('emits gte when from-date typed', async () => {
    const def: DataTableFilter<{ created: string }> = {
      type: 'date-range',
      key: 'created',
      label: 'Created',
    }
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
    const def: DataTableFilter<{ q: string }> = { type: 'text', key: 'q', label: 'Q' }
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TextEditor def={def} current={undefined} onChange={onChange} />)
    const input = screen.getByPlaceholderText('Q')
    await user.type(input, 'h')
    expect(onChange).toHaveBeenLastCalledWith('q', { op: 'contains', value: 'h' })
    render(<TextEditor def={def} current={{ op: 'contains', value: 'h' }} onChange={onChange} />)
    const inputs = screen.getAllByPlaceholderText('Q')
    await user.clear(inputs[1]!)
    expect(onChange).toHaveBeenLastCalledWith('q', null)
  })
})
