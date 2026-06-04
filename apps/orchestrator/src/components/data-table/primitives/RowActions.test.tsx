import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import type { DataTableRowAction } from '../types'

import { RowActions } from './RowActions'

describe('RowActions', () => {
  it('returns null when actions is empty', () => {
    const { container } = renderWithProviders(<RowActions actions={[]} ariaLabel="Row actions" />)
    expect(container.querySelector('button')).toBeNull()
  })

  it('invokes onClick when a non-confirm action is selected', async () => {
    const onClick = vi.fn()
    const actions: DataTableRowAction[] = [{ label: 'Edit', onClick }]
    const user = userEvent.setup()
    renderWithProviders(<RowActions actions={actions} ariaLabel="Row actions" />)
    await user.click(await screen.findByRole('button', { name: /row actions/i }))
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('opens confirm dialog and only invokes onClick after confirmation', async () => {
    const onClick = vi.fn()
    const actions: DataTableRowAction[] = [
      {
        label: 'Delete',
        destructive: true,
        onClick,
        confirm: {
          title: 'Delete row?',
          description: 'This cannot be undone.',
        },
      },
    ]
    const user = userEvent.setup()
    renderWithProviders(<RowActions actions={actions} ariaLabel="Row actions" />)

    await user.click(await screen.findByRole('button', { name: /row actions/i }))
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }))

    expect(onClick).not.toHaveBeenCalled()
    expect(await screen.findByText(/delete row\?/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /bevestigen/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
