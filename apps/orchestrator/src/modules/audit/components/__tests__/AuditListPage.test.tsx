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
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { env } from '@/config/env'
import { i18n } from '@/lib/i18n'
import { server } from '@/mocks/server'
import type { AuditEventRead } from '@/modules/audit/schemas'

import { AuditListPage } from '../AuditListPage'

const baseUrl = env.API_BASE_URL

// `useRouteSearchTableState` is router-coupled UI state, not an HTTP boundary —
// it stays mocked. The data itself is served over MSW (project rule: tests
// intercept the network, never stub the query hook).
const { useRouteSearchTableStateMock, setFilterSpy } = vi.hoisted(() => ({
  useRouteSearchTableStateMock: vi.fn(),
  setFilterSpy: vi.fn(),
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
  action: 'execute',
  result: 'success',
  event_code: 'pathway.published',
  resource_type: 'Pathway',
  resource_id: '8a83f1c0-0000-0000-0000-000000000000',
  request_id: 'req-1',
  patient_id: null,
  purpose_of_use: null,
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
  event_code: null,
  resource_type: null,
  resource_id: null,
  request_id: 'req-2',
  patient_id: null,
  purpose_of_use: null,
  changes: null,
  context: { ip: '1.2.3.4', reason: 'bad credentials' },
}

function serveEvents(items: AuditEventRead[]): void {
  server.use(
    http.get(`${baseUrl}/audit-events`, () =>
      HttpResponse.json({
        items,
        page: 1,
        page_size: 25,
        total: items.length,
        total_pages: 1,
      }),
    ),
  )
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
  })

  it('renders events with action/result badges, actor fallback and resource', async () => {
    serveEvents([publishRow, loginFailRow])
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
    serveEvents([publishRow, loginFailRow])
    renderPage()
    await screen.findByText('Gepubliceerd')
    const toggles = screen.getAllByRole('button', { name: /rij uitklappen/i })
    await userEvent.click(toggles[0]!)
    // The expanded detail prints the raw context — assert a context key is visible.
    expect(await screen.findByText(/"version_no"/)).toBeInTheDocument()
    expect(screen.getByText(/Cardiac Rehab 2\.0/)).toBeInTheDocument()
  })

  it('exposes the action / result / resource / period filters (no search box)', async () => {
    serveEvents([publishRow, loginFailRow])
    renderPage()
    expect(await screen.findByRole('button', { name: /actie/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resultaat/i })).toBeInTheDocument()
    // hideSearch: no free-text search input
    expect(screen.queryByRole('searchbox')).toBeNull()
  })
})
