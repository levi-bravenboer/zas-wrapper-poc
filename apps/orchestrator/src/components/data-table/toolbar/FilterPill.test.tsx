import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import { FilterPill } from './FilterPill'
import type { DataTableFilter } from './Toolbar'

const def: DataTableFilter<{ role: string }> = {
  type: 'select',
  key: 'role',
  label: 'Role',
  options: [
    { value: 'admin', label: 'Admin' },
    { value: 'caregiver', label: 'Caregiver' },
  ],
}

describe('FilterPill', () => {
  it('inactive pill shows the field label only', async () => {
    renderWithProviders(<FilterPill def={def} value={undefined} onChange={() => {}} />)
    expect(await screen.findByRole('button', { name: /role/i })).toBeInTheDocument()
  })

  it('active pill shows "Label: Value" with a clear button', async () => {
    renderWithProviders(
      <FilterPill def={def} value={{ op: 'eq', value: 'admin' }} onChange={() => {}} />,
    )
    expect(await screen.findByText(/role:/i)).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove role filter|verwijder filter role/i })).toBeInTheDocument()
  })

  it('clicking inactive pill opens popover with the right editor', async () => {
    const user = userEvent.setup()
    renderWithProviders(<FilterPill def={def} value={undefined} onChange={() => {}} />)
    await user.click(await screen.findByRole('button', { name: /role/i }))
    expect(await screen.findByRole('combobox')).toBeInTheDocument()
  })

  it('clear button emits null', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <FilterPill def={def} value={{ op: 'eq', value: 'admin' }} onChange={onChange} />,
    )
    await user.click(
      await screen.findByRole('button', { name: /verwijder filter role/i }),
    )
    expect(onChange).toHaveBeenCalledWith('role', null)
  })
})
