import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { env } from '@/config/env'
import { i18n } from '@/lib/i18n'
import { server } from '@/mocks/server'
import { authKeys } from '@/modules/auth/keys'

import { Route as UsersRoute } from './users'

const baseUrl = env.API_BASE_URL
const ROW_USER_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222'

function makePage(items: Array<Record<string, unknown>> = []) {
  return {
    items,
    page: 1,
    page_size: 25,
    total: items.length,
    total_pages: 1,
  }
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: ROW_USER_ID,
    email: 'alice@zas.local',
    display_name: 'Alice Caregiver',
    role: 'caregiver',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function buildRouter(initialPath = '/users') {
  const rootRoute = createRootRoute()
  const UsersComponent = UsersRoute.options.component
  if (!UsersComponent) throw new Error('users route missing component')
  const usersRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/users',
    component: UsersComponent,
  })
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/users/$user_id',
    component: () => <div data-testid="detail-stub" />,
  })
  return createRouter({
    routeTree: rootRoute.addChildren([usersRoute, detailRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
}

function renderUsersPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(authKeys.me(), {
    id: 'actor-1',
    email: 'admin@zas.local',
    display_name: 'Admin',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    role: 'admin',
  })
  const router = buildRouter()
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nextProvider>,
  )
  return { router, qc }
}

describe('/_auth/users route', () => {
  it('renders rows returned by the list endpoint', async () => {
    server.use(
      http.get(`${baseUrl}/users`, () =>
        HttpResponse.json(
          makePage([row(), row({ id: OTHER_USER_ID, display_name: 'Bob Admin', role: 'admin' })]),
        ),
      ),
    )

    renderUsersPage()

    expect(await screen.findByText('Alice Caregiver')).toBeInTheDocument()
    expect(await screen.findByText('Bob Admin')).toBeInTheDocument()
  })

  it('surfaces an error state with a retry control on failed fetch', async () => {
    server.use(
      http.get(`${baseUrl}/users`, () => HttpResponse.json({ detail: 'boom' }, { status: 500 })),
    )

    renderUsersPage()

    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('navigates to the detail route when a row is clicked', async () => {
    server.use(http.get(`${baseUrl}/users`, () => HttpResponse.json(makePage([row()]))))

    const { router } = renderUsersPage()

    const rowEl = await screen.findByText('Alice Caregiver')
    await userEvent.click(rowEl)

    await waitFor(() => expect(router.state.location.pathname).toBe(`/users/${ROW_USER_ID}`))
  })
})
