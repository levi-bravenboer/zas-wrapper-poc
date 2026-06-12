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
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { Route as TaskDetailRoute } from './$taskId/index'
import { Route as TasksIndexRoute } from './index'

const { useTaskQueryMock, usePatientMock, useTasksQueryMock } = vi.hoisted(() => ({
  useTaskQueryMock: vi.fn(),
  usePatientMock: vi.fn(),
  useTasksQueryMock: vi.fn(),
}))

vi.mock('@/modules/tasks/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/modules/tasks/api')>()
  return {
    ...original,
    useTaskQuery: useTaskQueryMock,
    useTasksQuery: useTasksQueryMock,
  }
})

vi.mock('@/modules/patient/hooks', () => ({
  usePatient: usePatientMock,
  usePatientCareTeams: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useUpdatePatient: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

const TASK = {
  id: 't-1',
  source: 'appointment' as const,
  source_id: 't-1',
  due_at: new Date(Date.now() + 60 * 60_000).toISOString(),
  title: 'Controle bloeddruk',
  kind: 'consultation',
  priority: null,
  payload: {
    id: 't-1',
    patient: {
      id: 'p-1',
      family_name: 'Janssens',
      given_name: 'Anke',
      insz: '80051203412',
      primary_organisation_id: 'org-1',
    },
    starts_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    ends_at: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
    kind: 'consultation',
    modality: 'on_site',
    location_text: 'Polikliniek 1',
    status: 'booked',
    participants: [{ user_id: 'u-1', role: 'lead', user_display_name: 'Dr. Janssen' }],
  },
}

const PATIENT = {
  id: 'p-1',
  primary_organisation_id: 'org-1',
  given_name: 'Anke',
  family_name: 'Janssens',
  birth_date: '1985-03-12',
  gender: 'female' as const,
  source: 'local' as const,
  external_system: null,
  external_ref: null,
  external_version: null,
  last_synced_at: null,
  identifiers: [],
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
  deleted_at: null,
  created_by: 'u-1',
  updated_by: 'u-1',
  deleted_by: null,
}

function mountAt(initialPath: string): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )

  const rootRoute = createRootRoute()

  const IndexComponent = TasksIndexRoute.options.component
  const DetailComponent = TaskDetailRoute.options.component
  if (!IndexComponent || !DetailComponent) throw new Error('route component missing')

  const tasksIndex = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks',
    component: () => (
      <Wrap>
        <IndexComponent />
      </Wrap>
    ),
  })
  const taskDetail = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => (
      <Wrap>
        <DetailComponent />
      </Wrap>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([tasksIndex, taskDetail]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  render(<RouterProvider router={router as unknown as AnyRouter} />)
}

describe('/_auth/tasks routes', () => {
  beforeEach(() => {
    useTaskQueryMock.mockReset()
    usePatientMock.mockReset()
    useTasksQueryMock.mockReturnValue({ data: [], isLoading: false, isError: false })
    usePatientMock.mockReturnValue({
      data: PATIENT,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it('index renders the selection empty state', async () => {
    mountAt('/tasks')
    expect(await screen.findByText('Selecteer een taak')).toBeInTheDocument()
  })

  it('detail renders EntityDetailPage with the appointment context block above the tabs', async () => {
    useTaskQueryMock.mockReturnValue({
      data: TASK,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    mountAt('/tasks/t-1')

    expect(await screen.findByRole('heading', { name: /Janssens, Anke/ })).toBeInTheDocument()
    // Context block content
    expect(screen.getByText('Controle bloeddruk')).toBeInTheDocument()
    expect(screen.getByText(/Lead Dr\. Janssen/)).toBeInTheDocument()
    // Two clinical tabs only
    expect(screen.getByRole('tab', { name: /Metingen/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Labresultaten/ })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Afspraken/ })).toBeNull()
    // Context block precedes the tab strip in DOM order
    /* eslint-disable testing-library/no-node-access -- DOM-order assertion needs structural queries */
    const block = screen
      .getByText('Controle bloeddruk')
      .closest('[data-slot="appointment-context-block"]')
    const tablist = screen.getByRole('tablist')
    expect(block).not.toBeNull()
    expect(block!.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    /* eslint-enable testing-library/no-node-access */
  })

  it('detail renders not-found for a 404 task', async () => {
    useTaskQueryMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: Object.assign(new Error('not found'), { status: 404, name: 'ApiError' }),
      refetch: vi.fn(),
    })
    mountAt('/tasks/missing')
    expect(await screen.findByText(/Niet gevonden/i)).toBeInTheDocument()
  })
})
