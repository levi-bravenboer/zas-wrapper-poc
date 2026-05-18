import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ExpandToggle } from './ExpandToggle'

describe('ExpandToggle', () => {
  it('renders collapsed state with aria-expanded=false', () => {
    render(
      <table>
        <tbody>
          <tr>
            <ExpandToggle expanded={false} onToggle={() => {}} />
          </tr>
        </tbody>
      </table>,
    )
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  })

  it('renders expanded state and calls onToggle', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(
      <table>
        <tbody>
          <tr>
            <ExpandToggle expanded={true} onToggle={onToggle} />
          </tr>
        </tbody>
      </table>,
    )
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    await user.click(btn)
    expect(onToggle).toHaveBeenCalled()
  })
})
