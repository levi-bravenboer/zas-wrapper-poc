import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SelectionCell, SelectionHeader } from './SelectionCell'

describe('SelectionCell / SelectionHeader', () => {
  it('SelectionHeader renders checkbox reflecting indeterminate and calls onToggle', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(
      <table>
        <thead>
          <tr>
            <SelectionHeader state="some" onToggle={onToggle} />
          </tr>
        </thead>
      </table>,
    )
    const cb = screen.getByRole('checkbox', { name: /select page/i })
    expect(cb).toHaveAttribute('data-state', 'indeterminate')
    await user.click(cb)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('SelectionCell renders row checkbox and calls onToggle with id', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(
      <table>
        <tbody>
          <tr>
            <SelectionCell rowId="r-1" checked={false} onToggle={onToggle} />
          </tr>
        </tbody>
      </table>,
    )
    await user.click(screen.getByRole('checkbox', { name: /select row r-1/i }))
    expect(onToggle).toHaveBeenCalledWith('r-1')
  })
})
