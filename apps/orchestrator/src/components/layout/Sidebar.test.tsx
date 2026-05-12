import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Outlet,
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

import { Sidebar } from './Sidebar'
import { navItems } from './navItems'

function renderSidebarAt(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <Sidebar />
        <Outlet />
      </>
    ),
  })
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

describe('Sidebar', () => {
  it('renders every nav item with its translated Dutch label', async () => {
    renderSidebarAt('/dashboard')

    expect(await screen.findByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Taken' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zorgpaden' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mijn patiënten' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Instellingen' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(navItems.length)
  })

  it('marks only the active route with aria-current', async () => {
    renderSidebarAt('/zorgpaden')

    const zorgpaden = await screen.findByRole('link', { name: 'Zorgpaden' })
    expect(zorgpaden).toHaveAttribute('aria-current', 'page')

    for (const name of ['Dashboard', 'Taken', 'Mijn patiënten', 'Instellingen']) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current')
    }
  })
})
