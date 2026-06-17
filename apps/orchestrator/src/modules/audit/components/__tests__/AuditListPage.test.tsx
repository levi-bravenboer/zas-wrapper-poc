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
import type { AuditEventRead } from '@/modules/audit/schemas'

import { AuditListPage } from '../AuditListPage'

const { usePaginatedQueryMock, useRouteSearchTableStateMock, setFilterSpy } = vi.hoisted(() => ({
  usePaginatedQueryMock: vi.fn(),
  useRouteSearchTableStateMock: vi.fn(),
  setFilterSpy: vi.fn(),
}))

vi.mock('@/hooks/use-paginated-query', () => ({
  usePaginatedQuery: usePaginatedQueryMock,
}))
vi.mock('@/hooks/use-route-search-table-state', () => ({
  useRouteSearchTableState: useRouteSearchTableStateMock,
}))

const publishRow: AuditEventRead = {
  id: 'ev-publish',
  created_at: '2026-06-16T14:31:00Z',
  actor_type: 'user',
  actor_id: 'u-lee',
  actor_label: 'Dr. Lee',
  tenant_id: 't-1',
  action: 'published',
  result: 'success',
  resource_type: 'Pathway',
  resource_id: '8a83f1c0-0000-0000-0000-000000000000',
  request_id: 'req-1',
  changes: null,
  context: { operation: null, version_no: 2, label: 'Cardiac Rehab 2.0' },
}

const loginFailRow: AuditEventRead = {
  id: 'ev-login',
  created_at: '2026-06-16T13:40:00Z',
  actor_type: 'anonymous',
  actor_id: null,
  actor_label: null,
  tenant_id: null,
  action: 'login',
  result: 'failure',
  resource_type: null,
  resource_id: null,
  request_id: 'req-2',
  changes: null,
  context: { ip: '1.2.3.4', reason: 'bad credentials' },
}

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
        <AuditListPage />
      </Wrap>
    ),
  })
  const childRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/admin/audit-log',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([childRoute]),
    history: createMemoryHistory({ initialEntries: ['/admin/audit-log'] }),
  })
  render(<RouterProvider router={router as unknown as AnyRouter} />)
}

describe('AuditListPage', () => {
  beforeEach(() => {
    usePaginatedQueryMock.mockReset()
    useRouteSearchTableStateMock.mockReset()
    setFilterSpy.mockReset()

    useRouteSearchTableStateMock.mockReturnValue([
      { page: 1, pageSize: 25, q: null, orderBy: null, order: 'asc', filters: {} },
      {
        setSearch: vi.fn(),
        setFilter: setFilterSpy,
        clearFilter: vi.fn(),
        clearAll: vi.fn(),
        setPage: vi.fn(),
        setPageSize: vi.fn(),
        reset: vi.fn(),
      },
    ])
    usePaginatedQueryMock.mockReturnValue({
      data: {
        items: [publishRow, loginFailRow],
        page: 1,
        page_size: 25,
        total: 2,
        total_pages: 1,
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it('renders events with action/result badges, actor fallback and resource', async () => {
    renderPage()
    // Action badges (NL)
    expect(await screen.findByText('Gepubliceerd')).toBeInTheDocument()
    expect(screen.getByText('Inloggen')).toBeInTheDocument()
    // Result: failed login is "Mislukt"
    expect(screen.getByText('Mislukt')).toBeInTheDocument()
    // Actor fallback for anonymous login
    expect(screen.getByText('(anoniem)')).toBeInTheDocument()
    // Actor label for the publish
    expect(screen.getByText('Dr. Lee')).toBeInTheDocument()
    // Resource type shown for the pathway, em-dash for the login
    expect(screen.getByText('Pathway')).toBeInTheDocument()
  })

  it('expanding a row reveals the raw context JSON', async () => {
    renderPage()
    await screen.findByText('Gepubliceerd')
    const toggles = screen.getAllByRole('button', { name: /rij uitklappen/i })
    await userEvent.click(toggles[0]!)
    // The expanded detail prints the raw context — assert a context key is visible.
    expect(await screen.findByText(/"version_no"/)).toBeInTheDocument()
    expect(screen.getByText(/Cardiac Rehab 2\.0/)).toBeInTheDocument()
  })

  it('exposes the action / result / resource / period filters (no search box)', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: /actie/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resultaat/i })).toBeInTheDocument()
    // hideSearch: no free-text search input
    expect(screen.queryByRole('searchbox')).toBeNull()
  })
})
