import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import { DataTableToolbar, type DataTableFilter } from './DataTableToolbar'

interface Row {
  role: string
  status: string
  created: string
  priority: string
  team: string
}

const defs: ReadonlyArray<DataTableFilter<Row>> = [
  {
    type: 'select',
    key: 'role',
    label: 'Role',
    options: [
      { value: 'admin', label: 'Admin' },
      { value: 'caregiver', label: 'Caregiver' },
    ],
  },
  {
    type: 'select',
    key: 'status',
    label: 'Status',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
  { type: 'date-range', key: 'created', label: 'Created' },
  { type: 'text', key: 'priority', label: 'Priority' },
  {
    type: 'multi',
    key: 'team',
    label: 'Team',
    options: [{ value: 't1', label: 'T1' }],
  },
]

describe('DataTableToolbar — inline filter strip', () => {
  it('renders first 3 filter defs as inline pills (always visible)', async () => {
    renderWithProviders(
      <DataTableToolbar<Row>
        q={null}
        filters={{}}
        filterDefs={defs}
        onSearchChange={() => {}}
        onFilterChange={() => {}}
        onClearFilters={() => {}}
      />,
    )
    expect(await screen.findByRole('button', { name: /role/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /status/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^created/i })).toBeInTheDocument()
  })

  it('collapses defs beyond 3 into "+N meer"', async () => {
    renderWithProviders(
      <DataTableToolbar<Row>
        q={null}
        filters={{}}
        filterDefs={defs}
        onSearchChange={() => {}}
        onFilterChange={() => {}}
        onClearFilters={() => {}}
      />,
    )
    expect(await screen.findByRole('button', { name: /\+2 meer/i })).toBeInTheDocument()
  })

  it('active filter pill shows "Label: Value" and × clears', async () => {
    const onFilterChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <DataTableToolbar<Row>
        q={null}
        filters={{ role: { op: 'eq', value: 'admin' } }}
        filterDefs={defs}
        onSearchChange={() => {}}
        onFilterChange={onFilterChange}
        onClearFilters={() => {}}
      />,
    )
    expect(await screen.findByText(/role:/i)).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /verwijder filter role/i }))
    expect(onFilterChange).toHaveBeenCalledWith('role', null)
  })

  it('"Filters wissen" appears only when any filter active', async () => {
    const { rerender } = renderWithProviders(
      <DataTableToolbar<Row>
        q={null}
        filters={{}}
        filterDefs={defs}
        onSearchChange={() => {}}
        onFilterChange={() => {}}
        onClearFilters={() => {}}
      />,
    )
    expect(await screen.findByRole('button', { name: /role/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /filters wissen/i })).toBeNull()
    rerender(
      <DataTableToolbar<Row>
        q={null}
        filters={{ role: { op: 'eq', value: 'admin' } }}
        filterDefs={defs}
        onSearchChange={() => {}}
        onFilterChange={() => {}}
        onClearFilters={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /filters wissen/i })).toBeInTheDocument()
  })

  it('clicking inline pill opens popover with editor', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <DataTableToolbar<Row>
        q={null}
        filters={{}}
        filterDefs={defs}
        onSearchChange={() => {}}
        onFilterChange={() => {}}
        onClearFilters={() => {}}
      />,
    )
    await user.click(await screen.findByRole('button', { name: /role/i }))
    expect(await screen.findByRole('menuitemradio', { name: /admin/i })).toBeInTheDocument()
  })
})
