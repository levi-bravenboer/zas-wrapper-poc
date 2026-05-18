/* eslint-disable i18next/no-literal-string -- inline test fixtures. */
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'

import { EntityDetailPage } from '../EntityDetailPage'

function renderPage(node: React.ReactNode): ReturnType<typeof render> {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <>{node}</>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nextProvider>,
  )
}

describe('EntityDetailPage', () => {
  it('renders title, subtitle, actions, body and back link', async () => {
    renderPage(
      <EntityDetailPage
        title="Patient X"
        subtitle="MRN 123"
        back={{ to: '/' }}
        actions={<button type="button">Acties</button>}
        body={<div data-testid="body">body</div>}
      />,
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Patient X' })).toBeTruthy()
    expect(screen.getByText('MRN 123')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Acties' })).toBeTruthy()
    expect(screen.getByTestId('body')).toBeTruthy()
    const backLink = screen.getByRole('link', { name: /terug/i })
    expect(backLink.getAttribute('href')).toBe('/')
  })

  it('omits back link when not provided', () => {
    renderPage(<EntityDetailPage title="X" body={<div />} />)
    expect(screen.queryByRole('link', { name: /terug/i })).toBeNull()
  })
})
