import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { type ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePaginatedQuery } from '@/hooks/use-paginated-query'
import { i18n } from '@/lib/i18n'
import { useAppointmentsQuery } from '@/modules/appointment/hooks'
import { PATIENTS_PATH } from '@/modules/patient/api'

import { Route as IndexRoute } from './index'

vi.mock('@/hooks/use-paginated-query', () => ({ usePaginatedQuery: vi.fn() }))
vi.mock('@/modules/appointment/hooks', () => ({ useAppointmentsQuery: vi.fn() }))

const usePaginatedQueryMock = vi.mocked(usePaginatedQuery)
const useAppointmentsQueryMock = vi.mocked(useAppointmentsQuery)

type QueryState = { data?: unknown; isLoading?: boolean; isError?: boolean }

function paginated(patients: QueryState, tasks: QueryState): void {
  usePaginatedQueryMock.mockImplementation(
    (path: string) => (path === PATIENTS_PATH ? patients : tasks) as never,
  )
}

function appointments(state: QueryState): void {
  useAppointmentsQueryMock.mockReturnValue(state as never)
}

function renderHome(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rootRoute = createRootRoute()
  const HomeComponent = IndexRoute.options.component
  if (!HomeComponent) throw new Error('index route missing component')
  const stub = (): ReactElement => <div />
  const home = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomeComponent })
  const children = [
    home,
    createRoute({ getParentRoute: () => rootRoute, path: '/patients/$patientId', component: stub }),
    createRoute({ getParentRoute: () => rootRoute, path: '/tasks', component: stub }),
    createRoute({ getParentRoute: () => rootRoute, path: '/tasks/$taskId', component: stub }),
    createRoute({ getParentRoute: () => rootRoute, path: '/appointments', component: stub }),
  ]
  const router = createRouter({
    routeTree: rootRoute.addChildren(children),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nextProvider>,
  )
}

describe('_auth/ index route (home overview)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Overzicht PageHeader and the KPI heading', async () => {
    paginated({ isLoading: true }, { isLoading: true })
    appointments({ isLoading: true })
    renderHome()
    expect(await screen.findByRole('heading', { level: 1, name: 'Overzicht' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Vandaag' })).toBeTruthy()
  })

  it('shows live KPI counts and no messages tile', async () => {
    paginated({ data: { total: 7, items: [] } }, { data: { total: 3, items: [] } })
    appointments({
      data: [
        {
          id: 'a1',
          title: 'X',
          starts_at: '2999-01-01T10:00:00Z',
          status: 'booked',
          patient: { id: 'p1' },
        },
      ],
    })
    renderHome()
    expect(await screen.findByText('7')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy() // one upcoming appointment
    expect(screen.queryByText('Nieuwe berichten')).toBeNull()
  })

  it('renders an em-dash when a KPI count fails', async () => {
    paginated({ isError: true }, { data: { total: 3, items: [] } })
    appointments({ data: [] })
    renderHome()
    expect(await screen.findByText('—')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('renders pending tasks that drill down to the patient', async () => {
    paginated(
      { data: { total: 1, items: [] } },
      {
        data: {
          total: 1,
          items: [
            {
              id: 't1',
              title: 'Bloeddruk controleren',
              patient_id: 'p9',
              status: 'open',
              due_at: '2999-01-01T09:00:00Z',
            },
          ],
        },
      },
    )
    appointments({ data: [] })
    renderHome()
    const row = await screen.findByRole('link', { name: /Bloeddruk controleren/ })
    expect(row.getAttribute('href')).toContain('/patients/p9')
    expect(screen.getByText('Bekijk alle taken')).toBeTruthy()
  })

  it('shows the empty state when there are no appointments', async () => {
    paginated({ data: { total: 0, items: [] } }, { data: { total: 0, items: [] } })
    appointments({ data: [] })
    renderHome()
    expect(await screen.findByText('Geen geplande afspraken')).toBeTruthy()
  })
})
