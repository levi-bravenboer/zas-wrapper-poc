import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import { textColumn } from './columns'
import { DataTable } from './DataTable'

interface Row {
  id: string
  name: string
}

const rows: Row[] = [
  { id: 'r1', name: 'Alice' },
  { id: 'r2', name: 'Bob' },
]

const columns = [textColumn<Row, 'name'>('name', 'Name', 'name')]

describe('DataTable — row click', () => {
  it('adds role="button" and tabIndex=0 to body rows when onRowClick is set', async () => {
    renderWithProviders(
      <DataTable<Row> data={rows} columns={columns} getRowId={(r) => r.id} onRowClick={() => {}} />,
    )

    const cell = await screen.findByText('Alice')
    const aliceRow = cell.closest('tr') as HTMLElement
    expect(aliceRow.getAttribute('tabindex')).toBe('0')
    expect(aliceRow.getAttribute('role')).toBe('button')
  })

  it('invokes handler on click', async () => {
    const onRowClick = vi.fn<(row: Row) => void>()
    renderWithProviders(
      <DataTable<Row>
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={onRowClick}
      />,
    )

    const cell = await screen.findByText('Alice')
    // Click bubbles up from the cell to the row.
    fireEvent.click(cell)

    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })

  it('activates on Enter and Space', async () => {
    const onRowClick = vi.fn<(row: Row) => void>()
    renderWithProviders(
      <DataTable<Row>
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={onRowClick}
      />,
    )

    const cell = await screen.findByText('Alice')
    const alice = cell.closest('tr') as HTMLElement
    alice.focus()

    fireEvent.keyDown(alice, { key: 'Enter' })
    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick).toHaveBeenLastCalledWith(rows[0])

    fireEvent.keyDown(alice, { key: ' ' })
    expect(onRowClick).toHaveBeenCalledTimes(2)
    expect(onRowClick).toHaveBeenLastCalledWith(rows[0])

    // Other keys do not activate.
    fireEvent.keyDown(alice, { key: 'a' })
    expect(onRowClick).toHaveBeenCalledTimes(2)
  })

  it('does NOT invoke handler when the click originates on the selection checkbox', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn<(row: Row) => void>()

    renderWithProviders(
      <DataTable<Row>
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        selectable
        selectedIds={new Set<string>()}
        onSelectionChange={() => {}}
        onRowClick={onRowClick}
      />,
    )

    const cell = await screen.findByText('Alice')
    const aliceRow = cell.closest('tr') as HTMLElement
    const checkbox = within(aliceRow).getByRole('checkbox')
    await user.click(checkbox)

    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('does NOT invoke handler when the click originates on the row-actions trigger', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn<(row: Row) => void>()
    const rowActions = () => [{ label: 'Do', onClick: vi.fn() }]

    renderWithProviders(
      <DataTable<Row>
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        rowActions={rowActions}
        onRowClick={onRowClick}
      />,
    )

    const cell = await screen.findByText('Alice')
    const aliceRow = cell.closest('tr') as HTMLElement
    const trigger = within(aliceRow).getByRole('button', { name: 'Acties voor rij' })
    await user.click(trigger)

    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('does NOT invoke handler when the click originates on the expand chevron', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn<(row: Row) => void>()

    renderWithProviders(
      <DataTable<Row>
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        renderExpandedRow={() => <div>expanded</div>}
        onRowClick={onRowClick}
      />,
    )

    const cell = await screen.findByText('Alice')
    const aliceRow = cell.closest('tr') as HTMLElement
    const chevron = within(aliceRow).getByRole('button', { name: 'Rij uitklappen' })
    await user.click(chevron)

    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('does NOT invoke handler from a click anywhere inside a `data-stop-row-click` cell', async () => {
    // Defensive: even direct clicks on the cell wrapper should be ignored.
    const onRowClick = vi.fn<(row: Row) => void>()
    renderWithProviders(
      <DataTable<Row>
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        selectable
        selectedIds={new Set<string>()}
        onSelectionChange={() => {}}
        onRowClick={onRowClick}
      />,
    )

    const cell = await screen.findByText('Alice')
    const aliceRow = cell.closest('tr') as HTMLElement
    const stopCell = aliceRow.querySelector('[data-stop-row-click]') as HTMLElement
    expect(stopCell).not.toBeNull()
    fireEvent.click(stopCell)
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('does NOT set role="button" or tabIndex when onRowClick is absent', async () => {
    renderWithProviders(<DataTable<Row> data={rows} columns={columns} getRowId={(r) => r.id} />)

    const cell = await screen.findByText('Alice')
    const alice = cell.closest('tr') as HTMLElement
    expect(alice.getAttribute('role')).not.toBe('button')
    expect(alice.getAttribute('tabindex')).toBeNull()
  })
})
