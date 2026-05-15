import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import { DataTable } from './DataTable'
import { defineColumn } from './columns'
import type { DataTableRowAction } from './types'

interface Demo {
  id: string
  name: string
}

const rows: Demo[] = [
  { id: 'r1', name: 'Alice' },
  { id: 'r2', name: 'Bob' },
]

const columns = [
  defineColumn<Demo>({
    id: 'name',
    header: 'Name',
    cell: (row) => row.name,
  }),
]

/**
 * §22.7 — row actions menu.
 *
 * The actions cell is rendered when `rowActions` is set on `DataTable`. The
 * menu must:
 *   - open via the trailing trigger button (`MoreHorizontal`)
 *   - mark disabled items with `aria-disabled`
 *   - apply destructive styling for `destructive: true` items
 *   - stop click propagation on both the trigger and menu items so a parent
 *     row-click handler is never fired by interacting with the menu
 */
describe('DataTable — row actions', () => {
  function renderTable(
    rowActions: (row: Demo) => DataTableRowAction[],
    onRowClick?: (row: Demo) => void,
  ) {
    return renderWithProviders(
      <DataTable<Demo>
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        rowActions={rowActions}
        {...(onRowClick ? { onRowClick } : {})}
      />,
    )
  }

  async function getTriggers(): Promise<HTMLElement[]> {
    await screen.findByText('Alice')
    return screen.getAllByRole('button', { name: /Acties voor rij/i })
  }

  it('opens the menu when the trigger is clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    renderTable(() => [{ label: 'Edit', onClick }])

    const triggers = await getTriggers()
    expect(triggers).toHaveLength(rows.length)

    await user.click(triggers[0]!)

    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeInTheDocument()
  })

  it('marks disabled menu items with aria-disabled and does not invoke onClick', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    renderTable(() => [
      { label: 'Edit', onClick: vi.fn() },
      { label: 'Archive', onClick, disabled: true },
    ])

    const triggers = await getTriggers()
    await user.click(triggers[0]!)

    const disabledItem = await screen.findByRole('menuitem', { name: 'Archive' })
    expect(disabledItem).toHaveAttribute('aria-disabled', 'true')

    await user.click(disabledItem)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('applies destructive styling to destructive items', async () => {
    const user = userEvent.setup()
    renderTable(() => [{ label: 'Delete', destructive: true, onClick: vi.fn() }])

    const triggers = await getTriggers()
    await user.click(triggers[0]!)

    const destructiveItem = await screen.findByRole('menuitem', { name: 'Delete' })
    expect(destructiveItem.className).toMatch(/text-destructive/)
  })

  it('clicking the trigger does NOT fire the surrounding row-click handler', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    renderTable(() => [{ label: 'Edit', onClick: vi.fn() }], onRowClick)

    const triggers = await getTriggers()
    await user.click(triggers[0]!)
    // Confirm the menu opened (so the click made it through) before asserting.
    await screen.findByRole('menuitem', { name: 'Edit' })

    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('clicking a menu item does NOT fire the surrounding row-click handler', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    const itemOnClick = vi.fn()
    renderTable(() => [{ label: 'Edit', onClick: itemOnClick }], onRowClick)

    const triggers = await getTriggers()
    await user.click(triggers[0]!)
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))

    expect(itemOnClick).toHaveBeenCalledTimes(1)
    expect(onRowClick).not.toHaveBeenCalled()
  })
})
