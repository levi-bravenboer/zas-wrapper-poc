import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SortHeader } from './SortHeader'

describe('SortHeader', () => {
  it('shows label, sortable button, aria-sort=none when inactive', () => {
    render(
      <table>
        <thead>
          <tr>
            <SortHeader sortKey="name" iconState={null} ariaSort="none" onCycle={() => {}}>
              Name
            </SortHeader>
          </tr>
        </thead>
      </table>,
    )
    const th = screen.getByRole('columnheader')
    expect(th).toHaveAttribute('aria-sort', 'none')
    expect(screen.getByRole('button', { name: /name/i })).toBeInTheDocument()
  })

  it('invokes onCycle on click', async () => {
    const onCycle = vi.fn()
    const user = userEvent.setup()
    render(
      <table>
        <thead>
          <tr>
            <SortHeader sortKey="name" iconState={null} ariaSort="none" onCycle={onCycle}>
              Name
            </SortHeader>
          </tr>
        </thead>
      </table>,
    )
    await user.click(screen.getByRole('button', { name: /name/i }))
    expect(onCycle).toHaveBeenCalledWith('name')
  })

  it('aria-sort reflects ascending/descending', () => {
    const { rerender } = render(
      <table>
        <thead>
          <tr>
            <SortHeader sortKey="name" iconState="asc" ariaSort="ascending" onCycle={() => {}}>
              Name
            </SortHeader>
          </tr>
        </thead>
      </table>,
    )
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'ascending')
    rerender(
      <table>
        <thead>
          <tr>
            <SortHeader sortKey="name" iconState="desc" ariaSort="descending" onCycle={() => {}}>
              Name
            </SortHeader>
          </tr>
        </thead>
      </table>,
    )
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending')
  })
})
