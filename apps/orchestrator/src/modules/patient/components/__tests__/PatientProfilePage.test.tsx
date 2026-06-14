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

import { PatientProfilePage } from '../PatientProfilePage'

const { getMock, usePatientMock, usePatientCareTeamsMock, useUpdatePatientMock } = vi.hoisted(
  () => ({
    getMock: vi.fn(),
    usePatientMock: vi.fn(),
    usePatientCareTeamsMock: vi.fn(),
    useUpdatePatientMock: vi.fn(),
  }),
)

vi.mock('@/lib/api/client', () => ({
  api: { GET: getMock },
}))

vi.mock('../../hooks', () => ({
  usePatient: usePatientMock,
  usePatientCareTeams: usePatientCareTeamsMock,
  useUpdatePatient: useUpdatePatientMock,
}))

const PATIENT = {
  id: 'pat-1',
  primary_organisation_id: 'org-1',
  given_name: 'Eva',
  family_name: 'Bos',
  birth_date: '1980-05-12',
  gender: 'female' as const,
  source: 'local' as const,
  external_system: null,
  external_ref: null,
  external_version: null,
  last_synced_at: null,
  identifiers: [
    { system: 'urn:oid:2.16.56.10.2.4.10.2', value: '80051203412', use: 'official' as const },
  ],
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-02-02T11:00:00Z',
  deleted_at: null,
  created_by: 'u-admin',
  updated_by: 'u-admin',
  deleted_by: null,
}

function stubQuery<T>(data: T) {
  return { data, isLoading: false, error: null, refetch: vi.fn() }
}

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )

  const rootRoute = createRootRoute({
    component: () => (
      <Wrap>
        <PatientProfilePage patientId={PATIENT.id} />
      </Wrap>
    ),
  })
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks',
    component: () => <div data-testid="list">list</div>,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <div data-testid="root" />,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, listRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router as unknown as AnyRouter} />)
}

describe('PatientProfilePage', () => {
  beforeEach(() => {
    getMock.mockReset()
    usePatientMock.mockReset()
    usePatientCareTeamsMock.mockReset()
    useUpdatePatientMock.mockReset()
    usePatientCareTeamsMock.mockReturnValue(stubQuery([]))
    useUpdatePatientMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    getMock.mockResolvedValue({
      data: { items: [{ id: 'org-1', name: 'ZAS Mechelen' }] },
      response: new Response(null, { status: 200 }),
    })
  })

  it('renders header with name + INSZ + the two clinical tabs', async () => {
    usePatientMock.mockReturnValue(stubQuery(PATIENT))
    renderPage()

    expect(await screen.findByRole('heading', { name: /Bos, Eva/ })).toBeTruthy()
    expect(screen.getAllByText(/80051203412/).length).toBeGreaterThan(0)
    expect(screen.getByRole('tab', { name: /Metingen/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Labresultaten/ })).toBeTruthy()
    // Legacy meta tabs are gone per D10
    expect(screen.queryByRole('tab', { name: /Overzicht/ })).toBeNull()
    expect(screen.queryByRole('tab', { name: /Zorgteam/ })).toBeNull()
    expect(screen.queryByRole('tab', { name: /Geschiedenis/ })).toBeNull()
    expect(screen.queryByRole('tab', { name: /Afspraken/ })).toBeNull()
  })

  it('back link points to /tasks', async () => {
    usePatientMock.mockReturnValue(stubQuery(PATIENT))
    renderPage()

    const back = await screen.findByRole('link', { name: /Terug/i })
    expect(back).toHaveAttribute('href', expect.stringContaining('/tasks'))
  })

  it('renders not-found state when patient is missing', async () => {
    usePatientMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    renderPage()
    expect(await screen.findByText(/Niet gevonden/i)).toBeTruthy()
  })
})
