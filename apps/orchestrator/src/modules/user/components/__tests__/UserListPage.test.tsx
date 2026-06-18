/* eslint-disable i18next/no-literal-string -- inline test fixtures, not user copy. */
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
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { UserListPage } from '../UserListPage'

const {
  usePaginatedQueryMock,
  useSetUserActiveMock,
  useSessionMock,
  useRouteSearchTableStateMock,
} = vi.hoisted(() => ({
  usePaginatedQueryMock: vi.fn(),
  useSetUserActiveMock: vi.fn(),
  useSessionMock: vi.fn(),
  useRouteSearchTableStateMock: vi.fn(),
}))

vi.mock('@/hooks/use-paginated-query', () => ({
  usePaginatedQuery: usePaginatedQueryMock,
}))
vi.mock('../../hooks', () => ({
  useSetUserActive: useSetUserActiveMock,
}))
vi.mock('@/modules/auth/hooks', () => ({
  useSession: useSessionMock,
}))
vi.mock('@/hooks/use-route-search-table-state', () => ({
  useRouteSearchTableState: useRouteSearchTableStateMock,
}))

const SELF_ID = 'u-self'

const rows = [
  {
    id: SELF_ID,
    email: 'self@zas.demo',
    display_name: 'Self Admin',
    role_id: 'a1111111-1111-4111-8111-1111111111a1',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'u-other',
    email: 'other@zas.demo',
    display_name: 'Other Caregiver',
    role_id: 'd2222222-2222-4222-8222-2222222222d1',
    is_active: true,
    created_at: '2026-01-02T00:00:00Z',
  },
]

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )
  const rootRoute = createRootRoute({
    component: () => (
      <Wrap>
        <UserListPage />
      </Wrap>
    ),
  })
  const stubRoutes = [
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/users/new',
      component: () => <div data-testid="new">new</div>,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/users/$userId',
      component: () => <div data-testid="detail">detail</div>,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/users/$userId/edit',
      component: () => <div data-testid="edit">edit</div>,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => null,
    }),
  ]
  const router = createRouter({
    routeTree: rootRoute.addChildren(stubRoutes),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router as unknown as AnyRouter} />)
  return { router }
}

describe('UserListPage', () => {
  beforeEach(() => {
    usePaginatedQueryMock.mockReset()
    useSetUserActiveMock.mockReset()
    useSessionMock.mockReset()
    useRouteSearchTableStateMock.mockReset()

    useSessionMock.mockReturnValue({ data: { id: SELF_ID } })
    useSetUserActiveMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
    useRouteSearchTableStateMock.mockReturnValue([
      { page: 1, pageSize: 25, q: null, orderBy: null, order: 'asc', filters: {} },
      {
        setSearch: vi.fn(),
        setFilter: vi.fn(),
        clearFilter: vi.fn(),
        clearAll: vi.fn(),
        setPage: vi.fn(),
        setPageSize: vi.fn(),
        reset: vi.fn(),
      },
    ])
    usePaginatedQueryMock.mockReturnValue({
      data: { items: rows, page: 1, page_size: 25, total: 2, total_pages: 1 },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it('renders rows for each user', async () => {
    renderPage()
    expect(await screen.findByText('Self Admin')).toBeTruthy()
    expect(screen.getByText('Other Caregiver')).toBeTruthy()
  })

  it('Deactiveren is disabled in kebab for the current admin own row', async () => {
    renderPage()
    await screen.findByText('Self Admin')
    const kebabs = screen.getAllByRole('button', { name: /open menu|acties|row actions/i })
    const selfKebab = kebabs[0]
    expect(selfKebab).toBeTruthy()
    await userEvent.click(selfKebab!)
    const deactivate = await screen.findByRole('menuitem', { name: /deactiveren/i })
    expect(deactivate.getAttribute('aria-disabled')).toBe('true')
  })

  it('renders Toevoegen primary action linking to /admin/users/new', async () => {
    renderPage()
    const link = await screen.findByRole('link', { name: /toevoegen/i })
    expect(link.getAttribute('href')).toBe('/admin/users/new')
  })
})
