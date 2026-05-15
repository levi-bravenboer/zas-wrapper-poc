import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import { DataTable } from './DataTable'
import { defineColumn, textColumn } from './columns'

interface Row {
  id: string
  name: string
  email: string
}

const rows: Row[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
]

const columns = [
  textColumn<Row, 'name'>('name', 'Name', 'name'),
  textColumn<Row, 'email'>('email', 'Email', 'email'),
]

describe('DataTable — render', () => {
  it('renders header cells and body cells from columns + data', async () => {
    renderWithProviders(<DataTable<Row> data={rows} columns={columns} getRowId={(r) => r.id} />)

    await screen.findByText('Alice')

    const table = screen.getByRole('table')
    const headerRow = within(table).getAllByRole('row')[0]
    if (!headerRow) throw new Error('no header row')
    const headers = within(headerRow).getAllByRole('columnheader')
    expect(headers).toHaveLength(2)
    expect(headers[0]).toHaveTextContent('Name')
    expect(headers[1]).toHaveTextContent('Email')

    expect(within(table).getByText('Alice')).toBeInTheDocument()
    expect(within(table).getByText('bob@example.com')).toBeInTheDocument()
  })

  it('applies the sticky-left class to the first data column header and cells by default', async () => {
    renderWithProviders(<DataTable<Row> data={rows} columns={columns} getRowId={(r) => r.id} />)

    await screen.findByText('Alice')

    const headers = screen.getAllByRole('columnheader')
    const [first, second] = headers
    if (!first || !second) throw new Error('expected two headers')
    expect(first.className).toMatch(/sticky/)
    expect(first.className).toMatch(/left-0/)
    expect(second.className).not.toMatch(/sticky/)

    // Body cells for the first column should also be sticky.
    const aliceCell = screen.getByText('Alice').closest('td')
    expect(aliceCell).not.toBeNull()
    expect(aliceCell!.className).toMatch(/sticky/)
    expect(aliceCell!.className).toMatch(/left-0/)

    const aliceEmailCell = screen.getByText('alice@example.com').closest('td')
    expect(aliceEmailCell!.className).not.toMatch(/sticky/)
  })

  it('honours an explicit `sticky: true` on a non-first column', async () => {
    const stickyCols = [
      textColumn<Row, 'name'>('name', 'Name', 'name'),
      defineColumn<Row>({
        id: 'email',
        header: 'Email',
        cell: (r) => r.email,
        sticky: true,
      }),
    ]
    renderWithProviders(<DataTable<Row> data={rows} columns={stickyCols} getRowId={(r) => r.id} />)

    await screen.findByText('Alice')

    const headers = screen.getAllByRole('columnheader')
    const second = headers[1]
    if (!second) throw new Error('expected two headers')
    expect(second.className).toMatch(/sticky/)
  })
})

describe('DataTable — state composition', () => {
  it('renders skeleton rows while `isLoading` is true (instead of empty/data)', async () => {
    const { container } = renderWithProviders(
      <DataTable<Row> data={[]} columns={columns} getRowId={(r) => r.id} isLoading />,
    )

    // Wait for the router to mount the table.
    await screen.findByRole('table')

    // Should not render the EmptyState while loading.
    expect(container.querySelector('[data-slot="empty-state"]')).toBeNull()
    // LoadingRows renders skeleton elements in the tbody.
    const skeletons = container.querySelectorAll('tbody [data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders the EmptyState when there is no data and not loading', async () => {
    renderWithProviders(<DataTable<Row> data={[]} columns={columns} getRowId={(r) => r.id} />)

    const empty = await screen.findByText('Geen resultaten')
    const wrapper = empty.closest('[data-slot="empty-state"]') as HTMLElement
    expect(wrapper).not.toBeNull()
    expect(wrapper).toHaveAttribute('role', 'status')
  })

  it('renders the refetch overlay when `isFetching` is true and not first-load', async () => {
    const { container } = renderWithProviders(
      <DataTable<Row> data={rows} columns={columns} getRowId={(r) => r.id} isFetching />,
    )

    await screen.findByText('Alice')

    // Overlay wraps the whole table and has an inner aria-busy="true" element when active.
    const overlayWrapper = container.querySelector('[data-slot="refetch-overlay"]')
    expect(overlayWrapper).not.toBeNull()
    const busy = (overlayWrapper as HTMLElement).querySelector('[aria-busy="true"]')
    expect(busy).not.toBeNull()
  })

  it('does NOT render the refetch overlay when `isLoading` is true (loading takes precedence)', async () => {
    const { container } = renderWithProviders(
      <DataTable<Row> data={[]} columns={columns} getRowId={(r) => r.id} isLoading isFetching />,
    )

    await screen.findByRole('table')

    const overlayWrapper = container.querySelector('[data-slot="refetch-overlay"]')
    expect(overlayWrapper).not.toBeNull()
    // No element inside the overlay wrapper has aria-busy=true (overlay inactive while loading).
    const busy = (overlayWrapper as HTMLElement).querySelector('[aria-busy="true"]')
    expect(busy).toBeNull()
  })

  it('renders ErrorState (and wires onRetry) when `error` is set', async () => {
    const onRetry = vi.fn()
    renderWithProviders(
      <DataTable<Row>
        data={[]}
        columns={columns}
        getRowId={(r) => r.id}
        error={new Error('boom')}
        onRetry={onRetry}
      />,
    )

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('boom')).toBeInTheDocument()

    // No `<table>` rendered when in error state.
    expect(screen.queryByRole('table')).toBeNull()

    const retry = within(alert).getByRole('button', { name: 'Retry' })
    retry.click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
