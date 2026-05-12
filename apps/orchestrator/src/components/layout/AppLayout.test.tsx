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

import { AppLayout } from './AppLayout'
import { navItems } from './navItems'

function mount(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rootRoute = createRootRoute({ component: AppLayout })
  const children = navItems.map((item) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: item.to,
      component: () => <div data-testid={`page-${item.to}`} />,
    }),
  )
  const router = createRouter({
    routeTree: rootRoute.addChildren(children),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router as never} />
      </QueryClientProvider>
    </I18nextProvider>,
  )
}

describe('AppLayout', () => {
  it('renders sidebar plus the active route content', async () => {
    mount('/zorgpaden')

    expect(await screen.findByRole('navigation', { name: 'primary' })).toBeInTheDocument()
    expect(screen.getByTestId('page-/zorgpaden')).toBeInTheDocument()
    expect(screen.queryByTestId('page-/dashboard')).not.toBeInTheDocument()
  })
})
