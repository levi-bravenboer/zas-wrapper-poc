 
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

import { EntityNotFound } from '../EntityNotFound'

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

describe('EntityNotFound', () => {
  it('renders Dutch copy and back link', async () => {
    renderPage(<EntityNotFound backTo={{ to: '/' }} />)
    expect(await screen.findByText('Niet gevonden')).toBeTruthy()
    expect(screen.getByText(/dit item bestaat niet/i)).toBeTruthy()
    const link = screen.getByRole('link', { name: /terug naar overzicht/i })
    expect(link.getAttribute('href')).toBe('/')
  })
})
