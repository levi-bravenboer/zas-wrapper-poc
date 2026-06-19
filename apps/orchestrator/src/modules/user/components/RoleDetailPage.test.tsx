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

import { RoleDetailPage } from './RoleDetailPage'

vi.mock('@/modules/auth/permissions', () => ({
  useCan: () => true,
  useCanAny: () => true,
  can: () => true,
}))

const baseUrl = env.API_BASE_URL

const ROLE_ID = '22222222-2222-4222-8222-222222222222'

const customRole = {
  id: ROLE_ID,
  slug: 'nurse',
  name: 'Verpleegkundige',
  is_system: false,
  permissions: ['user.read', 'user.create', 'role.update'],
}

function serveRole(role: unknown): void {
  server.use(http.get(`${baseUrl}/roles/${ROLE_ID}`, () => HttpResponse.json(role)))
}

function renderDetail(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )
  const rootRoute = createRootRoute({
    component: () => (
      <Wrap>
        <RoleDetailPage roleId={ROLE_ID} />
      </Wrap>
    ),
  })
  const children = ['/admin/roles', '/admin/roles/$roleId/edit'].map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
  )
  const router = createRouter({
    routeTree: rootRoute.addChildren(children),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router as unknown as AnyRouter} />)
}

describe('RoleDetailPage', () => {
  it('renders the role identity, permission count and grouped permission verbs', async () => {
    serveRole(customRole)
    renderDetail()

    // Name renders in both the page title and the detail card.
    expect((await screen.findAllByText('Verpleegkundige')).length).toBeGreaterThan(0)
    // Permissions grouped by resource → verb badges.
    expect(screen.getByText('read')).toBeInTheDocument()
    expect(screen.getByText('create')).toBeInTheDocument()
    expect(screen.getByText('update')).toBeInTheDocument()
    // Permission count (3).
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('offers an edit action linking to the role edit route', async () => {
    serveRole(customRole)
    renderDetail()
    await screen.findAllByText('Verpleegkundige')
    const editLink = screen.getByRole('link', { name: /bewerken/i })
    expect(editLink).toHaveAttribute('href', `/admin/roles/${ROLE_ID}/edit`)
  })
})
