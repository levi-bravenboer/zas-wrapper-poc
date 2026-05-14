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
// Side-effect import: registers the tasks feature for getFeaturesForSurface('app').
import '@/modules/tasks'

import { hardWiredNavItems } from './navItems'
import { Sidebar } from './Sidebar'

const FEATURE_PATHS = ['/tasks'] as const

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
  const allPaths = [...hardWiredNavItems.map((item) => item.to), ...FEATURE_PATHS]
  const children = allPaths.map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => <div data-testid={`page-${path}`} />,
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

describe('Sidebar', () => {
  it('renders every nav item including registry features with translated Dutch labels', async () => {
    renderSidebarAt('/dashboard')

    expect(await screen.findByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Taken' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zorgpaden' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mijn patiënten' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Instellingen' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(
      hardWiredNavItems.length + FEATURE_PATHS.length,
    )
  })

  it('marks only the active route with aria-current', async () => {
    renderSidebarAt('/pathways')

    const pathways = await screen.findByRole('link', { name: 'Zorgpaden' })
    expect(pathways).toHaveAttribute('aria-current', 'page')

    for (const name of ['Dashboard', 'Taken', 'Mijn patiënten', 'Instellingen']) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current')
    }
  })

  it('orders the tasks feature link between Dashboard and Zorgpaden via the feature order field', async () => {
    renderSidebarAt('/dashboard')

    const links = await screen.findAllByRole('link')
    const labels = links.map((link) => link.textContent?.trim())
    expect(labels).toEqual(['Dashboard', 'Taken', 'Zorgpaden', 'Mijn patiënten', 'Instellingen'])
  })
})
