import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

const matchesMock = vi.fn()

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return {
    ...actual,
    useMatches: () => matchesMock(),
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  }
})

import { PageHeader } from './PageHeader'

function wrap(ui: React.ReactElement) {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
}

describe('PageHeader', () => {
  it('renders only the required title when no slots are passed', () => {
    matchesMock.mockReturnValue([])
    render(wrap(<PageHeader title="Dashboard" />))

    expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /breadcrumb/i })).toBeNull()
  })

  it('renders eyebrow, sub, actions, and tabs slots when provided', () => {
    matchesMock.mockReturnValue([])
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

  it('renders auto breadcrumbs from useMatches when depth > 2', () => {
    matchesMock.mockReturnValue([
      { pathname: '/', staticData: {} },
      { pathname: '/patients', staticData: { breadcrumb: 'Patiënten' } },
      { pathname: '/patients/123', staticData: { breadcrumb: 'Jan Janssen' } },
    ])

    render(wrap(<PageHeader title="Jan Janssen" />))

    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Patiënten' })).toBeInTheDocument()
    expect(screen.getByText('Jan Janssen', { selector: '[data-slot="breadcrumb-page"]' })).toBeInTheDocument()
  })
})
