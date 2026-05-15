import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import { DataTable } from './DataTable'
import { defineColumn } from './columns'

interface Row {
  id: string
  name: string
}

const rows: Row[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
]

const sortableColumns = [
  defineColumn<Row>({ id: 'name', header: 'Name', cell: (r) => r.name, sortKey: 'name' }),
]

function getNameHeader(): HTMLElement {
  const headers = screen.getAllByRole('columnheader')
  const header = headers[0]
  if (!header) throw new Error('no column header rendered')
  return header
}

describe('DataTable — sort cycle', () => {
  it('cycles asc → desc → unset on successive header clicks', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <DataTable<Row> data={rows} columns={sortableColumns} getRowId={(r) => r.id} />,
    )

    await screen.findByText('Alice')
    const header = getNameHeader()
    const button = within(header).getByRole('button')

    expect(header).toHaveAttribute('aria-sort', 'none')

    await user.click(button)
    expect(getNameHeader()).toHaveAttribute('aria-sort', 'ascending')

    await user.click(within(getNameHeader()).getByRole('button'))
    expect(getNameHeader()).toHaveAttribute('aria-sort', 'descending')

    await user.click(within(getNameHeader()).getByRole('button'))
    expect(getNameHeader()).toHaveAttribute('aria-sort', 'none')
  })

  it('does not set aria-sort on non-sortable headers', async () => {
    const cols = [defineColumn<Row>({ id: 'name', header: 'Name', cell: (r) => r.name })]
    renderWithProviders(<DataTable<Row> data={rows} columns={cols} getRowId={(r) => r.id} />)

    await screen.findByText('Alice')
    const header = getNameHeader()
    expect(header).not.toHaveAttribute('aria-sort')
    expect(within(header).queryByRole('button')).toBeNull()
  })

  it('activates on Enter and Space keypresses', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <DataTable<Row> data={rows} columns={sortableColumns} getRowId={(r) => r.id} />,
    )

    await screen.findByText('Alice')
    const button = within(getNameHeader()).getByRole('button')
    button.focus()
    expect(button).toHaveFocus()

    // Enter: none -> asc
    await user.keyboard('{Enter}')
    expect(getNameHeader()).toHaveAttribute('aria-sort', 'ascending')

    // Space: asc -> desc
    await user.keyboard(' ')
    expect(getNameHeader()).toHaveAttribute('aria-sort', 'descending')

    // Enter: desc -> none
    await user.keyboard('{Enter}')
    expect(getNameHeader()).toHaveAttribute('aria-sort', 'none')
  })
})
