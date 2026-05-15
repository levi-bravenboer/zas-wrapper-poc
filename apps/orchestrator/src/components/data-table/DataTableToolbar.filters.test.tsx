import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import type { ListFilter } from '@/hooks/use-data-table-state'
import { i18n } from '@/lib/i18n'

import type { DataTableFilter } from './DataTableToolbar'
import { DataTableToolbar } from './DataTableToolbar'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

interface Row {
  status: string
  tags: string
  createdAt: string
  name: string
}

const SELECT_DEF: DataTableFilter<Row> = {
  type: 'select',
  key: 'status',
  label: 'Status',
  options: [
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
  ],
}

const MULTI_DEF: DataTableFilter<Row> = {
  type: 'multi',
  key: 'tags',
  label: 'Tags',
  options: [
    { value: 'urgent', label: 'Urgent' },
    { value: 'review', label: 'Review' },
    { value: 'archived', label: 'Archived' },
  ],
}

const DATE_RANGE_DEF: DataTableFilter<Row> = {
  type: 'date-range',
  key: 'createdAt',
  label: 'Created',
}

const TEXT_DEF: DataTableFilter<Row> = {
  type: 'text',
  key: 'name',
  label: 'Name',
}

const ALL_DEFS = [SELECT_DEF, MULTI_DEF, DATE_RANGE_DEF, TEXT_DEF] as const

/**
 * Test helper: open the built-in Filters dropdown.
 */
async function openFilters(): Promise<HTMLElement> {
  const trigger = screen.getByRole('button', { name: 'Filters' })
  await userEvent.click(trigger)
  return await screen.findByRole('menu')
}

describe('DataTableToolbar filters — rendering + emit shapes', () => {
  describe('chip rendering for active filters', () => {
    it('renders a chip for each active filter type with the expected display value', () => {
      const filters: Record<string, ListFilter | ListFilter[]> = {
        status: { op: 'eq', value: 'open' },
        tags: { op: 'in', value: ['urgent', 'review'] },
        createdAt: [
          { op: 'gte', value: '2026-01-01' },
          { op: 'lte', value: '2026-12-31' },
        ],
        name: { op: 'contains', value: 'abe' },
      }

      renderWithI18n(
        <DataTableToolbar
          q={null}
          filters={filters}
          filterDefs={ALL_DEFS}
          onSearchChange={vi.fn()}
          onFilterChange={vi.fn()}
          onClearFilters={vi.fn()}
        />,
      )

      // select chip uses option label
      expect(screen.getByText('Open')).toBeInTheDocument()
      // multi chip joins option labels
      expect(screen.getByText('Urgent, Review')).toBeInTheDocument()
      // date-range chip uses "from – to" formatting
      expect(screen.getByText('2026-01-01 – 2026-12-31')).toBeInTheDocument()
      // text chip displays raw value
      expect(screen.getByText('abe')).toBeInTheDocument()
    })

    it('omits chips for filters without a matching operator', () => {
      const filters: Record<string, ListFilter | ListFilter[]> = {
        // 'select' chip looks for op==='eq'; supply something else to make sure no chip leaks
        status: { op: 'in', value: ['open'] },
      }

      renderWithI18n(
        <DataTableToolbar
          q={null}
          filters={filters}
          filterDefs={[SELECT_DEF]}
          onSearchChange={vi.fn()}
          onFilterChange={vi.fn()}
          onClearFilters={vi.fn()}
        />,
      )

      expect(screen.queryByText('Open')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Filters wissen' })).not.toBeInTheDocument()
    })
  })

  describe('select filter', () => {
    it('renders a Radix Select trigger (combobox) inside the dropdown', async () => {
      renderWithI18n(
        <DataTableToolbar
          q={null}
          filters={{}}
          filterDefs={[SELECT_DEF]}
          onSearchChange={vi.fn()}
          onFilterChange={vi.fn()}
          onClearFilters={vi.fn()}
        />,
      )

      const menu = await openFilters()
      // The editor renders a Radix Select trigger inside the dropdown.
      expect(within(menu).getByRole('combobox')).toBeInTheDocument()
    })

    it('renders a chip when a select filter is active', () => {
      renderWithI18n(
        <DataTableToolbar
          q={null}
          filters={{ status: { op: 'eq', value: 'closed' } }}
          filterDefs={[SELECT_DEF]}
          onSearchChange={vi.fn()}
          onFilterChange={vi.fn()}
          onClearFilters={vi.fn()}
        />,
      )

      expect(screen.getByText('Closed')).toBeInTheDocument()
    })
  })

  describe('multi filter', () => {
    it('emits {op: "in", value: [...]} when toggling options', async () => {
      const onFilterChange = vi.fn()

      renderWithI18n(
        <DataTableToolbar
          q={null}
          filters={{}}
          filterDefs={[MULTI_DEF]}
          onSearchChange={vi.fn()}
          onFilterChange={onFilterChange}
          onClearFilters={vi.fn()}
        />,
      )

      const menu = await openFilters()

      const urgentBtn = within(menu).getByRole('button', { name: /Urgent/ })
      await userEvent.click(urgentBtn)

      expect(onFilterChange).toHaveBeenLastCalledWith('tags', { op: 'in', value: ['urgent'] })
    })

    it('removes the option and emits null when toggling its last selected value off', async () => {
      const onFilterChange = vi.fn()

      renderWithI18n(
        <DataTableToolbar
          q={null}
          filters={{ tags: { op: 'in', value: ['urgent'] } }}
          filterDefs={[MULTI_DEF]}
          onSearchChange={vi.fn()}
          onFilterChange={onFilterChange}
          onClearFilters={vi.fn()}
        />,
      )

      const menu = await openFilters()
      const urgentBtn = within(menu).getByRole('button', { name: /Urgent/ })
      await userEvent.click(urgentBtn)

      expect(onFilterChange).toHaveBeenLastCalledWith('tags', null)
    })
  })

  describe('date-range filter', () => {
    it('emits a single {op: "gte"} filter when only "from" is set', async () => {
      const onFilterChange = vi.fn()

      renderWithI18n(
        <DataTableToolbar
          q={null}
          filters={{}}
          filterDefs={[DATE_RANGE_DEF]}
          onSearchChange={vi.fn()}
          onFilterChange={onFilterChange}
          onClearFilters={vi.fn()}
        />,
      )

      const menu = await openFilters()
      const fromInput = within(menu)
        .getByText(/Created — van/)
        .closest('label')
        ?.querySelector('input[type="date"]') as HTMLInputElement

      expect(fromInput).toBeInstanceOf(HTMLInputElement)
      fireEvent.change(fromInput, { target: { value: '2026-02-01' } })

      expect(onFilterChange).toHaveBeenLastCalledWith('createdAt', {
        op: 'gte',
        value: '2026-02-01',
      })
    })

    it('emits an array with both gte + lte when both endpoints are set', async () => {
      const onFilterChange = vi.fn()

      renderWithI18n(
        <DataTableToolbar
          q={null}
          filters={{ createdAt: { op: 'gte', value: '2026-02-01' } }}
          filterDefs={[DATE_RANGE_DEF]}
          onSearchChange={vi.fn()}
          onFilterChange={onFilterChange}
          onClearFilters={vi.fn()}
        />,
      )

      const menu = await openFilters()
      const toInput = within(menu)
        .getByText(/Created — tot/)
        .closest('label')
        ?.querySelector('input[type="date"]') as HTMLInputElement

      fireEvent.change(toInput, { target: { value: '2026-03-15' } })

      expect(onFilterChange).toHaveBeenLastCalledWith('createdAt', [
        { op: 'gte', value: '2026-02-01' },
        { op: 'lte', value: '2026-03-15' },
      ])
    })
  })

  describe('text filter', () => {
    it('emits {op: "contains", value} on input and null when cleared', async () => {
      const onFilterChange = vi.fn()

      const { rerender } = renderWithI18n(
        <DataTableToolbar
          q={null}
          filters={{}}
          filterDefs={[TEXT_DEF]}
          onSearchChange={vi.fn()}
          onFilterChange={onFilterChange}
          onClearFilters={vi.fn()}
        />,
      )

      const menu = await openFilters()
      const textbox = within(menu).getByPlaceholderText('Name') as HTMLInputElement

      fireEvent.change(textbox, { target: { value: 'abel' } })
      expect(onFilterChange).toHaveBeenLastCalledWith('name', {
        op: 'contains',
        value: 'abel',
      })

      // Re-render with the active filter so we can verify clearing emits null.
      rerender(
        <I18nextProvider i18n={i18n}>
          <DataTableToolbar
            q={null}
            filters={{ name: { op: 'contains', value: 'abel' } }}
            filterDefs={[TEXT_DEF]}
            onSearchChange={vi.fn()}
            onFilterChange={onFilterChange}
            onClearFilters={vi.fn()}
          />
        </I18nextProvider>,
      )

      const menu2 = await screen.findByRole('menu')
      const textbox2 = within(menu2).getByPlaceholderText('Name') as HTMLInputElement
      fireEvent.change(textbox2, { target: { value: '' } })
      expect(onFilterChange).toHaveBeenLastCalledWith('name', null)
    })
  })

  describe('clear-all button', () => {
    it('renders when at least one chip is active and calls onClearFilters when clicked', async () => {
      const onClearFilters = vi.fn()

      renderWithI18n(
        <DataTableToolbar
          q={null}
          filters={{ status: { op: 'eq', value: 'open' } }}
          filterDefs={[SELECT_DEF]}
          onSearchChange={vi.fn()}
          onFilterChange={vi.fn()}
          onClearFilters={onClearFilters}
        />,
      )

      const clearAll = screen.getByRole('button', { name: 'Filters wissen' })
      await userEvent.click(clearAll)

      expect(onClearFilters).toHaveBeenCalledTimes(1)
    })

    it('is hidden when no chips are active', () => {
      renderWithI18n(
        <DataTableToolbar
          q={null}
          filters={{}}
          filterDefs={ALL_DEFS}
          onSearchChange={vi.fn()}
          onFilterChange={vi.fn()}
          onClearFilters={vi.fn()}
        />,
      )

      expect(screen.queryByRole('button', { name: 'Filters wissen' })).not.toBeInTheDocument()
    })
  })
})
