import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

import { Route as IndexRoute } from './index'

describe('_auth/ index route (home overview)', () => {
  it('renders the Overzicht PageHeader and the KPI heading', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const rootRoute = createRootRoute()
    const HomeComponent = IndexRoute.options.component
    if (!HomeComponent) throw new Error('index route missing component')
    const homeRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: HomeComponent,
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([homeRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })

    render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </I18nextProvider>,
    )

    expect(await screen.findByRole('heading', { level: 1, name: 'Overzicht' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Vandaag' })).toBeTruthy()
  })
})
