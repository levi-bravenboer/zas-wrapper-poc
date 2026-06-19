import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRouter,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'

import { i18n } from '@/lib/i18n'

interface RenderWithRoutesOptions {
  /** Extra route paths to register so the component's <Link>s can resolve their
   *  targets (e.g. `['/admin/roles/$roleId/edit']`). */
  routes?: string[]
  /** Memory-history entry point. */
  initialPath?: string
}

/** Renders `ui` at the router root inside i18n + Query providers, registering
 *  any `routes` the component links to. Replaces the bespoke root-route +
 *  provider boilerplate duplicated across component tests. */
export function renderWithRoutes(
  ui: ReactElement,
  { routes = [], initialPath = '/' }: RenderWithRoutesOptions = {},
): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const rootRoute = createRootRoute({
    component: () => (
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
      </I18nextProvider>
    ),
  })
  const children = routes.map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
  )
  const router = createRouter({
    routeTree: rootRoute.addChildren(children),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  render(<RouterProvider router={router as unknown as AnyRouter} />)
}
