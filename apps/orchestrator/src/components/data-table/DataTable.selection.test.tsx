import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { DataTableState } from '@/hooks/use-data-table-state'
import { renderWithProviders } from '@/test/renderWithProviders'

import { DataTable } from './DataTable'
import { textColumn } from './columns'

interface Row {
  id: string
  name: string
}

const page1: Row[] = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
]

const page2: Row[] = [
  { id: 'c', name: 'Carol' },
  { id: 'd', name: 'Dan' },
]

const columns = [textColumn<Row, 'name'>('name', 'Name', 'name')]

function getHeaderCheckbox(): HTMLElement {
  const head = document.querySelector('thead') as HTMLElement
  return within(head).getByRole('checkbox')
}

describe('DataTable — selection: header checkbox', () => {
  it('toggles the current-page rows when the header checkbox is clicked', async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn<(next: Set<string>) => void>()

    renderWithProviders(
      <DataTable<Row>
        data={page1}
        columns={columns}
        getRowId={(r) => r.id}
        selectable
        selectedIds={new Set<string>()}
        onSelectionChange={onSelectionChange}
      />,
    )

    await screen.findByText('Alice')
    await user.click(getHeaderCheckbox())

    expect(onSelectionChange).toHaveBeenCalledTimes(1)
    const next = onSelectionChange.mock.calls[0]![0]
    expect(Array.from(next).sort()).toEqual(['a', 'b'])
  })

  it('header checkbox is indeterminate when only some rows are selected', async () => {
    renderWithProviders(
      <DataTable<Row>
        data={page1}
        columns={columns}
        getRowId={(r) => r.id}
        selectable
        selectedIds={new Set<string>(['a'])}
        onSelectionChange={() => {}}
      />,
    )

    await screen.findByText('Alice')
    const header = getHeaderCheckbox()
    // Radix sets data-state="indeterminate" on the root.
    expect(header).toHaveAttribute('data-state', 'indeterminate')
  })
})

describe('DataTable — selection: cross-page persistence', () => {
  it('preserves selected ids that disappear because the page changed', async () => {
    function Harness() {
      const [data, setData] = React.useState<Row[]>(page1)
      const [state, setState] = React.useState<DataTableState>({
        page: 1,
        pageSize: 25,
        q: null,
        orderBy: null,
        order: 'asc',
        filters: {},
      })
      const [selected, setSelected] = React.useState<Set<string>>(new Set(['a']))
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setData(page2)
              setState((s) => ({ ...s, page: 2 }))
            }}
          >
            next-page
          </button>
          <div data-testid="selected">{Array.from(selected).sort().join(',')}</div>
          <DataTable<Row>
            data={data}
            columns={columns}
            getRowId={(r) => r.id}
            selectable
            selectedIds={selected}
            onSelectionChange={setSelected}
            state={state}
            onStateChange={setState}
          />
        </>
      )
    }

    renderWithProviders(<Harness />)

    await screen.findByText('Alice')
    expect(screen.getByTestId('selected')).toHaveTextContent('a')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'next-page' }))

    // Page changed: 'a' is no longer in the rendered data, but should still be selected.
    await waitFor(() => {
      expect(screen.queryByText('Alice')).toBeNull()
    })
    expect(screen.getByText('Carol')).toBeInTheDocument()

    // Selection survives even though id 'a' is no longer on the visible page.
    expect(screen.getByTestId('selected')).toHaveTextContent('a')

    // Header checkbox should report "none" because page 2 has zero selected.
    expect(getHeaderCheckbox().getAttribute('data-state')).not.toBe('checked')
  })
})

describe('DataTable — selection: refetch reconciliation', () => {
  it('drops selected ids that were on the previous page but vanish after refetch', async () => {
    function Harness() {
      // Same page (no other-page semantics): refetch on the SAME page where row
      // 'a' was deleted between fetches. The DataTable's reconcile effect must
      // drop 'a' because the previously-rendered page no longer contains it.
      const [data, setData] = React.useState<Row[]>(page1)
      const [selected, setSelected] = React.useState<Set<string>>(new Set(['a', 'b']))
      return (
        <>
          <button
            type="button"
            onClick={() =>
              setData([
                // 'a' removed, 'b' remains, plus a new row 'x'.
                { id: 'b', name: 'Bob' },
                { id: 'x', name: 'New' },
              ])
            }
          >
            refetch
          </button>
          <div data-testid="selected">{Array.from(selected).sort().join(',')}</div>
          <DataTable<Row>
            data={data}
            columns={columns}
            getRowId={(r) => r.id}
            selectable
            selectedIds={selected}
            onSelectionChange={setSelected}
          />
        </>
      )
    }

    renderWithProviders(<Harness />)

    await screen.findByText('Alice')
    expect(screen.getByTestId('selected')).toHaveTextContent('a,b')

    act(() => {
      screen.getByRole('button', { name: 'refetch' }).click()
    })

    // 'a' must be reconciled out (was on the page, now gone), 'b' must remain.
    await waitFor(() => {
      expect(screen.getByTestId('selected')).toHaveTextContent(/^b$/)
    })
  })
})

describe('DataTable — BulkBar slot', () => {
  it('renders count + cancel button when selection is non-empty', async () => {
    renderWithProviders(
      <DataTable<Row>
        data={page1}
        columns={columns}
        getRowId={(r) => r.id}
        selectable
        selectedIds={new Set<string>(['a', 'b'])}
        onSelectionChange={() => {}}
      >
        <DataTable.BulkBar>
          <button type="button">Custom action</button>
        </DataTable.BulkBar>
      </DataTable>,
    )

    await screen.findByText('Alice')

    const region = document.querySelector('[data-slot="data-table-bulk-bar"]') as HTMLElement
    expect(region).not.toBeNull()
    expect(region).toHaveAttribute('data-slot', 'data-table-bulk-bar')
    expect(region).toHaveAttribute('data-visible', 'true')
    expect(within(region).getByText('2 geselecteerd')).toBeInTheDocument()
    expect(within(region).getByRole('button', { name: 'Annuleren' })).toBeInTheDocument()
    expect(within(region).getByRole('button', { name: 'Custom action' })).toBeInTheDocument()
  })

  it('renders as hidden when nothing is selected', async () => {
    renderWithProviders(
      <DataTable<Row>
        data={page1}
        columns={columns}
        getRowId={(r) => r.id}
        selectable
        selectedIds={new Set<string>()}
        onSelectionChange={() => {}}
      >
        <DataTable.BulkBar />
      </DataTable>,
    )

    await screen.findByText('Alice')
    const region = document.querySelector('[data-slot="data-table-bulk-bar"]') as HTMLElement
    expect(region).not.toBeNull()
    expect(region).toHaveAttribute('data-visible', 'false')
  })

  it('cancel button clears selection (controlled)', async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn<(next: Set<string>) => void>()

    renderWithProviders(
      <DataTable<Row>
        data={page1}
        columns={columns}
        getRowId={(r) => r.id}
        selectable
        selectedIds={new Set<string>(['a'])}
        onSelectionChange={onSelectionChange}
      >
        <DataTable.BulkBar />
      </DataTable>,
    )

    await screen.findByText('Alice')
    await user.click(screen.getByRole('button', { name: 'Annuleren' }))
    expect(onSelectionChange).toHaveBeenCalledTimes(1)
    expect(Array.from(onSelectionChange.mock.calls[0]![0])).toEqual([])
  })
})
