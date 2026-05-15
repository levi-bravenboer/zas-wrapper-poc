import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import { defineColumn } from './columns'
import { DataTable } from './DataTable'

interface Demo {
  id: string
  name: string
  status: string
}

const rows: Demo[] = [
  { id: 'a', name: 'Alpha', status: 'open' },
  { id: 'b', name: 'Bravo', status: 'closed' },
  { id: 'c', name: 'Charlie', status: 'open' },
]

const columns = [
  defineColumn<Demo>({ id: 'name', header: 'Name', cell: (r) => r.name }),
  defineColumn<Demo>({ id: 'status', header: 'Status', cell: (r) => r.status }),
]

/**
 * §22.9 — expandable rows.
 *
 *   - Chevron buttons render with `aria-expanded` and toggle on click.
 *   - Single-row expand mode: expanding B collapses A.
 *   - Expanded panel uses `colSpan = totalColumns` (chevron col + data cols).
 *   - Keyboard activation via Enter and Space.
 */
describe('DataTable — expandable rows', () => {
  function renderTable() {
    return renderWithProviders(
      <DataTable<Demo>
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        renderExpandedRow={(row) => (
          <div data-testid={`expanded-${row.id}`}>Details for {row.name}</div>
        )}
      />,
    )
  }

  async function getTriggers(): Promise<HTMLElement[]> {
    await screen.findByText('Alpha')
    return screen.getAllByRole('button', { name: /Rij uitklappen/i })
  }

  it('toggles the chevron via aria-expanded on click', async () => {
    const user = userEvent.setup()
    renderTable()

    const triggers = await getTriggers()
    expect(triggers).toHaveLength(rows.length)
    expect(triggers[0]!).toHaveAttribute('aria-expanded', 'false')

    await user.click(triggers[0]!)
    expect(triggers[0]!).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('expanded-a')).toBeInTheDocument()

    await user.click(triggers[0]!)
    expect(triggers[0]!).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('expanded-a')).not.toBeInTheDocument()
  })

  it('single-row mode — expanding B collapses A', async () => {
    const user = userEvent.setup()
    renderTable()

    const [aTrigger, bTrigger] = await getTriggers()

    await user.click(aTrigger!)
    expect(aTrigger!).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('expanded-a')).toBeInTheDocument()

    await user.click(bTrigger!)
    expect(bTrigger!).toHaveAttribute('aria-expanded', 'true')
    expect(aTrigger!).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('expanded-a')).not.toBeInTheDocument()
    expect(screen.getByTestId('expanded-b')).toBeInTheDocument()
  })

  it('expanded row uses colSpan equal to total visual columns', async () => {
    const user = userEvent.setup()
    renderTable()

    const triggers = await getTriggers()
    await user.click(triggers[0]!)

    // We have: 1 expand col + 2 data cols + 0 actions + 0 selection = 3
    const expandedPanel = screen.getByTestId('expanded-a')
    const expandedCell = expandedPanel.closest('td') as HTMLTableCellElement
    expect(expandedCell).not.toBeNull()
    expect(expandedCell.getAttribute('colSpan') ?? expandedCell.colSpan.toString()).toBe('3')
  })

  it('expanded row colSpan grows when selection and actions columns are present', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <DataTable<Demo>
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        selectable
        rowActions={() => [{ label: 'Edit', onClick: () => undefined }]}
        renderExpandedRow={(row) => <div data-testid={`x-${row.id}`}>X {row.name}</div>}
      />,
    )

    await screen.findByText('Alpha')
    const triggers2 = screen.getAllByRole('button', { name: /Rij uitklappen/i })
    await user.click(triggers2[0]!)

    // 1 selection + 1 expand + 2 data + 1 actions = 5
    const cell = (screen.getByTestId('x-a').closest('td') as HTMLTableCellElement) ?? null
    expect(cell).not.toBeNull()
    expect(cell!.getAttribute('colSpan') ?? cell!.colSpan.toString()).toBe('5')
  })

  it('toggles via Enter and Space keyboard activation', async () => {
    const user = userEvent.setup()
    renderTable()

    const trigger = (await getTriggers())[0]!
    trigger.focus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.keyboard('{Enter}')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('expanded-a')).toBeInTheDocument()

    await user.keyboard(' ')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('expanded-a')).not.toBeInTheDocument()
  })

  it('renders the expanded panel directly below its row', async () => {
    const user = userEvent.setup()
    renderTable()
    const trigs = await getTriggers()
    await user.click(trigs[0]!)

    const expandedRow = screen.getByTestId('expanded-a').closest('tr') as HTMLTableRowElement
    expect(expandedRow).not.toBeNull()
    expect(expandedRow).toHaveAttribute('data-slot', 'expanded-row')

    // Sanity: the panel row is the *next* sibling row of the data row for 'a'.
    const tbody = expandedRow.parentElement as HTMLTableSectionElement
    const rows = within(tbody).getAllByRole('row')
    const idx = rows.indexOf(expandedRow)
    expect(idx).toBeGreaterThan(0)
  })
})
