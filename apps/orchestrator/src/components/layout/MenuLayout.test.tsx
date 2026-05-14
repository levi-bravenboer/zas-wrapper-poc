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

import { MenuLayout } from './MenuLayout'
import { hardWiredNavItems } from './navItems'

function mount(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rootRoute = createRootRoute({ component: MenuLayout })
  const children = hardWiredNavItems.map((item) =>
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
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nextProvider>,
  )
}

describe('MenuLayout', () => {
  it('renders sidebar plus the active route content', async () => {
    mount('/pathways')

    expect(await screen.findByRole('navigation', { name: 'primary' })).toBeInTheDocument()
    expect(screen.getByTestId('page-/pathways')).toBeInTheDocument()
    expect(screen.queryByTestId('page-/dashboard')).not.toBeInTheDocument()
  })
})
