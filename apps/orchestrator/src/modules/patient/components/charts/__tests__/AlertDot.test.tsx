import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'

import { AlertDot } from '../AlertDot'

function renderWithI18n(ui: ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

describe('AlertDot', () => {
  it('marks a critical severity for the red flag', () => {
    renderWithI18n(<AlertDot flag="red" />)
    const dot = screen.getByTestId('alert-dot')
    expect(dot).toHaveAttribute('data-severity', 'critical')
    expect(dot).toHaveAttribute('role', 'img')
  })

  it('marks a warning severity for any other flag', () => {
    renderWithI18n(<AlertDot flag="orange" />)
    expect(screen.getByTestId('alert-dot')).toHaveAttribute('data-severity', 'warning')
  })

  it('renders a neutral, aria-hidden placeholder when there is no alert', () => {
    renderWithI18n(<AlertDot flag={null} />)
    const dot = screen.getByTestId('alert-dot')
    expect(dot).toHaveAttribute('data-severity', 'none')
    expect(dot).toHaveAttribute('aria-hidden', 'true')
  })
})
