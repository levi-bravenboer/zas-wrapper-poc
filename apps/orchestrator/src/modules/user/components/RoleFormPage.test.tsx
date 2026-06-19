import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRouter,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import { env } from '@/config/env'
import { i18n } from '@/lib/i18n'
import { server } from '@/mocks/server'

import { RoleFormPage } from './RoleFormPage'

// The actor holds user.* but NOT role.update — drives the no-amplification gate.
vi.mock('@/modules/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: ['user.read', 'user.create'] } }),
}))

const baseUrl = env.API_BASE_URL

const CATALOG = ['user.read', 'user.create', 'role.update']

function servePermissions(): void {
  server.use(http.get(`${baseUrl}/permissions`, () => HttpResponse.json(CATALOG)))
}

function renderCreate(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )
  const rootRoute = createRootRoute({
    component: () => (
      <Wrap>
        <RoleFormPage mode="create" />
      </Wrap>
    ),
  })
  const rolesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/admin/roles',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([rolesRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router as unknown as AnyRouter} />)
}

describe('RoleFormPage (create)', () => {
  it('renders the name + slug fields and the permission catalogue grouped by resource', async () => {
    servePermissions()
    renderCreate()

    expect(await screen.findByText('read')).toBeInTheDocument()
    // Name + slug inputs are present.
    expect(screen.getByLabelText('Naam')).toBeInTheDocument()
    expect(screen.getByLabelText('Slug')).toBeInTheDocument()
    // One checkbox per catalogue permission.
    expect(screen.getAllByRole('checkbox')).toHaveLength(CATALOG.length)
  })

  it('locks a permission the actor does not hold (no-amplification)', async () => {
    servePermissions()
    renderCreate()
    await screen.findByText('update')

    // role.update is not in the actor's permission set → its checkbox is disabled.
    const checkboxes = screen.getAllByRole('checkbox')
    const disabled = checkboxes.filter((c) => c.hasAttribute('disabled') || c.getAttribute('aria-disabled') === 'true' || c.getAttribute('data-disabled') !== null)
    expect(disabled.length).toBe(1)
  })
})
