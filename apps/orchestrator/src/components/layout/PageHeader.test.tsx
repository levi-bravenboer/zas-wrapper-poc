import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'

import { PageHeader } from './PageHeader'

function wrap(ui: React.ReactElement) {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
}

describe('PageHeader', () => {
  it('renders only the required title when no slots are passed', () => {
    render(wrap(<PageHeader title="Dashboard" />))

    expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /kruimelpad/i })).toBeNull()
  })

  it('renders eyebrow, sub, actions, and tabs slots when provided', () => {
    render(
      wrap(
        <PageHeader
          eyebrow="Sectie"
          title="Patiënten"
          sub="Actieve dossiers"
          /* eslint-disable-next-line i18next/no-literal-string -- inline test fixture */
          actions={<button type="button">Nieuw</button>}
          /* eslint-disable-next-line i18next/no-literal-string -- inline test fixture */
          tabs={<nav aria-label="tabs">Tabs</nav>}
        />,
      ),
    )

    expect(screen.getByText('Sectie')).toBeInTheDocument()
    expect(screen.getByText('Actieve dossiers')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nieuw' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'tabs' })).toBeInTheDocument()
  })
})
