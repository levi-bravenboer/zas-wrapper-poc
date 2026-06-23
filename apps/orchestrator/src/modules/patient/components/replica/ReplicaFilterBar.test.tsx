import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { ReplicaFilterBar } from './ReplicaFilterBar'

function renderWithI18n(ui: ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

describe('ReplicaFilterBar', () => {
  it('renders every Luscii preset', () => {
    renderWithI18n(<ReplicaFilterBar active={90} onChange={vi.fn()} />)
    for (const key of ['7D', '14D', '30D', '3M', '6M', '12M']) {
      expect(screen.getByRole('button', { name: key })).toBeInTheDocument()
    }
  })

  it('marks the active preset via aria-pressed', () => {
    renderWithI18n(<ReplicaFilterBar active={90} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '3M' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '7D' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports the selected preset as a days-back window', async () => {
    const onChange = vi.fn()
    renderWithI18n(<ReplicaFilterBar active={90} onChange={onChange} />)
    await userEvent.setup().click(screen.getByRole('button', { name: '14D' }))
    expect(onChange).toHaveBeenCalledWith(14)
  })
})
