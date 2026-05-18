import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import { ClearAll } from './ClearAll'
import { Toolbar } from './Toolbar'

describe('Toolbar', () => {
  it('Root renders children with toolbar styles', async () => {
    renderWithProviders(
      <Toolbar.Root>
        <span data-testid="x">x</span>
      </Toolbar.Root>,
    )
    expect(await screen.findByTestId('x')).toBeInTheDocument()
  })
})

describe('ClearAll', () => {
  it('calls onClick', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<ClearAll onClick={onClick} />)
    await user.click(await screen.findByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })
})
