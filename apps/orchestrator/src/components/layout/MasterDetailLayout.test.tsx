import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MasterDetailLayout } from './MasterDetailLayout'

function masterSlot(): HTMLElement {
  return screen.getByTestId('mdl-master')
}

function renderLayout(props: {
  detail: React.ReactNode | null
  masterCollapsed: boolean
  onMasterCollapsedChange?: (v: boolean) => void
}) {
  return render(
    <MasterDetailLayout
      master={<div data-testid="mdl-master-content">M</div>}
      detail={props.detail}
      masterCollapsed={props.masterCollapsed}
      onMasterCollapsedChange={props.onMasterCollapsedChange ?? (() => {})}
    />,
  )
}

// The component sets `data-state` + `data-slot` on its slot wrappers. Tests
// query those via testid wrappers so we never touch the DOM directly.
function MasterDetailLayoutWithTestids({
  detail,
  masterCollapsed,
  onMasterCollapsedChange = () => {},
}: {
  detail: React.ReactNode | null
  masterCollapsed: boolean
  onMasterCollapsedChange?: (v: boolean) => void
}) {
  return (
    <MasterDetailLayout
      master={<div data-testid="mdl-master">M</div>}
      detail={detail}
      masterCollapsed={masterCollapsed}
      onMasterCollapsedChange={onMasterCollapsedChange}
    />
  )
}

describe('MasterDetailLayout', () => {
  it('renders master full-width when detail is null (state 1)', () => {
    render(<MasterDetailLayoutWithTestids detail={null} masterCollapsed={false} />)

    expect(masterSlot()).toBeInTheDocument()
    expect(screen.queryByTestId('mdl-detail')).toBeNull()
  })

  it('renders master rail + detail when detail is set (state 2)', () => {
    render(
      <MasterDetailLayoutWithTestids
        detail={<div data-testid="mdl-detail">D</div>}
        masterCollapsed={false}
      />,
    )

    expect(masterSlot()).toBeInTheDocument()
    expect(screen.getByTestId('mdl-detail')).toBeInTheDocument()
  })

  it('shows floating reopen button when collapsed (state 3) and invokes change handler', async () => {
    const onChange = vi.fn()
    render(
      <MasterDetailLayoutWithTestids
        detail={<div data-testid="mdl-detail">D</div>}
        masterCollapsed={true}
        onMasterCollapsedChange={onChange}
      />,
    )

    const reopen = screen.getByRole('button', { name: /open master/i })
    await userEvent.click(reopen)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('does not render reopen button when no detail is shown', () => {
    renderLayout({ detail: null, masterCollapsed: true })
    expect(screen.queryByRole('button', { name: /open master/i })).toBeNull()
  })
})
