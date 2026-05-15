import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { DataTablePagination } from './DataTablePagination'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

describe('DataTablePagination', () => {
  describe('prev / next bound disabling', () => {
    it('disables Previous on the first page', async () => {
      const onPageChange = vi.fn()

      renderWithI18n(
        <DataTablePagination
          page={1}
          pageSize={10}
          totalPages={5}
          onPageChange={onPageChange}
          onPageSizeChange={vi.fn()}
        />,
      )

      const prev = screen.getByRole('button', { name: 'Vorige' })
      expect(prev).toBeDisabled()
      expect(prev).toHaveAttribute('aria-disabled', 'true')

      // Next should still be active.
      const next = screen.getByRole('button', { name: 'Volgende' })
      expect(next).not.toBeDisabled()

      await userEvent.click(prev)
      expect(onPageChange).not.toHaveBeenCalled()
    })

    it('disables Next on the last page', async () => {
      const onPageChange = vi.fn()

      renderWithI18n(
        <DataTablePagination
          page={5}
          pageSize={10}
          totalPages={5}
          onPageChange={onPageChange}
          onPageSizeChange={vi.fn()}
        />,
      )

      const next = screen.getByRole('button', { name: 'Volgende' })
      expect(next).toBeDisabled()
      expect(next).toHaveAttribute('aria-disabled', 'true')

      // Previous should be active.
      expect(screen.getByRole('button', { name: 'Vorige' })).not.toBeDisabled()

      await userEvent.click(next)
      expect(onPageChange).not.toHaveBeenCalled()
    })

    it('calls onPageChange with the neighbouring page when buttons are active', async () => {
      const onPageChange = vi.fn()

      renderWithI18n(
        <DataTablePagination
          page={3}
          pageSize={10}
          totalPages={7}
          onPageChange={onPageChange}
          onPageSizeChange={vi.fn()}
        />,
      )

      await userEvent.click(screen.getByRole('button', { name: 'Vorige' }))
      expect(onPageChange).toHaveBeenLastCalledWith(2)

      await userEvent.click(screen.getByRole('button', { name: 'Volgende' }))
      expect(onPageChange).toHaveBeenLastCalledWith(4)
    })

    it('clamps disabled bounds when totalPages is 0 (empty state)', () => {
      renderWithI18n(
        <DataTablePagination
          page={1}
          pageSize={10}
          totalPages={0}
          onPageChange={vi.fn()}
          onPageSizeChange={vi.fn()}
        />,
      )

      expect(screen.getByRole('button', { name: 'Vorige' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Volgende' })).toBeDisabled()
    })
  })

  describe('indicator interpolation', () => {
    it('renders "{{page}} / {{total}}" with the supplied values', () => {
      renderWithI18n(
        <DataTablePagination
          page={2}
          pageSize={10}
          totalPages={7}
          onPageChange={vi.fn()}
          onPageSizeChange={vi.fn()}
        />,
      )

      expect(screen.getByText('2 / 7')).toBeInTheDocument()
    })

    it('clamps the total component of the indicator to at least 1', () => {
      renderWithI18n(
        <DataTablePagination
          page={1}
          pageSize={10}
          totalPages={0}
          onPageChange={vi.fn()}
          onPageSizeChange={vi.fn()}
        />,
      )

      expect(screen.getByText('1 / 1')).toBeInTheDocument()
    })
  })

  describe('page-size selector', () => {
    it('uses the supplied pageSize as the current value', () => {
      renderWithI18n(
        <DataTablePagination
          page={1}
          pageSize={25}
          totalPages={5}
          onPageChange={vi.fn()}
          onPageSizeChange={vi.fn()}
        />,
      )

      const trigger = screen.getByRole('combobox')
      expect(within(trigger).getByText('25')).toBeInTheDocument()
    })

    it('emits the new page size AND resets page to 1 when changed', async () => {
      const onPageChange = vi.fn()
      const onPageSizeChange = vi.fn()

      renderWithI18n(
        <DataTablePagination
          page={4}
          pageSize={10}
          totalPages={7}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />,
      )

      // Radix Select keyboard interaction: focus the trigger, open with Enter,
      // step down to the next option, commit with Enter.
      const trigger = screen.getByRole('combobox')
      trigger.focus()
      await userEvent.keyboard('{Enter}')

      const option = await screen.findByRole('option', { name: '25' })
      await userEvent.click(option)

      expect(onPageSizeChange).toHaveBeenCalledTimes(1)
      expect(onPageSizeChange).toHaveBeenCalledWith(25)
      expect(onPageChange).toHaveBeenCalledTimes(1)
      expect(onPageChange).toHaveBeenCalledWith(1)
    })

    it('honours a custom pageSizeOptions prop', () => {
      renderWithI18n(
        <DataTablePagination
          page={1}
          pageSize={20}
          totalPages={5}
          pageSizeOptions={[20, 40, 80]}
          onPageChange={vi.fn()}
          onPageSizeChange={vi.fn()}
        />,
      )

      const trigger = screen.getByRole('combobox')
      expect(within(trigger).getByText('20')).toBeInTheDocument()
    })
  })
})
