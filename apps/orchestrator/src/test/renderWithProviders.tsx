import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { render, type RenderResult } from '@testing-library/react'
import * as React from 'react'
import { I18nextProvider } from 'react-i18next'

import { Toaster } from '@/components/ui/Toaster'
import { i18n } from '@/lib/i18n'

type RenderOptions = {
  route?: string
}

export function renderWithProviders(
  ui: React.ReactElement,
  { route = '/' }: RenderOptions = {},
): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <>{ui}</>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: [route] }),
  })

  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router as never} />
        <Toaster />
      </QueryClientProvider>
    </I18nextProvider>,
  )
}
