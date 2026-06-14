import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { MasterDetailLayout } from './MasterDetailLayout'

function renderLayout(props: {
  detail: React.ReactNode | null
  masterCollapsed: boolean
  onMasterCollapsedChange?: (v: boolean) => void
}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MasterDetailLayout
        master={<div data-testid="mdl-master">M</div>}
        detail={props.detail}
        masterCollapsed={props.masterCollapsed}
        onMasterCollapsedChange={props.onMasterCollapsedChange ?? (() => {})}
      />
    </I18nextProvider>,
  )
}

describe('MasterDetailLayout', () => {
  it('renders master full-width when detail is null (state 1)', () => {
    renderLayout({ detail: null, masterCollapsed: false })

    expect(screen.getByTestId('mdl-master')).toBeInTheDocument()
    expect(screen.queryByTestId('mdl-detail')).toBeNull()
  })

  it('renders master rail + detail when detail is set (state 2)', () => {
    renderLayout({
      detail: <div data-testid="mdl-detail">D</div>,
      masterCollapsed: false,
    })

    expect(screen.getByTestId('mdl-master')).toBeInTheDocument()
    expect(screen.getByTestId('mdl-detail')).toBeInTheDocument()
  })

  it('shows floating reopen button when collapsed (state 3) and invokes change handler', async () => {
    const onChange = vi.fn()
    renderLayout({
      detail: <div data-testid="mdl-detail">D</div>,
      masterCollapsed: true,
      onMasterCollapsedChange: onChange,
    })

    const reopen = screen.getByRole('button', { name: /lijst tonen/i })
    await userEvent.click(reopen)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('does not render reopen button when no detail is shown', () => {
    renderLayout({ detail: null, masterCollapsed: true })
    expect(screen.queryByRole('button', { name: /lijst tonen/i })).toBeNull()
  })
})
