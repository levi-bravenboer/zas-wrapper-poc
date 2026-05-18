import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import { FilterOverflow } from './FilterOverflow'

const defs = [
  {
    type: 'select' as const,
    key: 'role',
    label: 'Role',
    options: [{ value: 'admin', label: 'Admin' }],
  },
  { type: 'text' as const, key: 'note', label: 'Note' },
]

describe('FilterOverflow', () => {
  it('renders "+N meer" with count', async () => {
    renderWithProviders(<FilterOverflow defs={defs} filters={{}} onChange={() => {}} />)
    expect(await screen.findByRole('button', { name: /\+2 meer/i })).toBeInTheDocument()
  })

  it('opens popover listing each def label', async () => {
    const user = userEvent.setup()
    renderWithProviders(<FilterOverflow defs={defs} filters={{}} onChange={() => {}} />)
    await user.click(await screen.findByRole('button', { name: /\+2 meer/i }))
    expect((await screen.findAllByText('Role')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Note').length).toBeGreaterThan(0)
  })

  it('renders nothing when defs is empty', () => {
    const { container } = renderWithProviders(
      <FilterOverflow defs={[]} filters={{}} onChange={() => {}} />,
    )
    expect(container.querySelector('button')).toBeNull()
  })
})
