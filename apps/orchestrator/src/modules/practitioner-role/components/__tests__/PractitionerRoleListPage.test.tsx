import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRouter,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'
import type { PractitionerRoleRead } from '@/modules/practitioner-role/schemas'

import { PractitionerRoleListPage } from '../PractitionerRoleListPage'

const {
  usePaginatedQueryMock,
  useOrganisationsMock,
  useRouteSearchTableStateMock,
  useClosePractitionerRoleMock,
  setFilterSpy,
  clearFilterSpy,
} = vi.hoisted(() => ({
  usePaginatedQueryMock: vi.fn(),
  useOrganisationsMock: vi.fn(),
  useRouteSearchTableStateMock: vi.fn(),
  useClosePractitionerRoleMock: vi.fn(),
  setFilterSpy: vi.fn(),
  clearFilterSpy: vi.fn(),
}))

vi.mock('@/hooks/use-paginated-query', () => ({
  usePaginatedQuery: usePaginatedQueryMock,
}))
vi.mock('@/modules/organisation/hooks', () => ({
  useOrganisations: useOrganisationsMock,
}))
vi.mock('@/hooks/use-route-search-table-state', () => ({
  useRouteSearchTableState: useRouteSearchTableStateMock,
}))
vi.mock('../../hooks', () => ({
  useClosePractitionerRole: useClosePractitionerRoleMock,
  useOpenPractitionerRole: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useUpdatePractitionerRole: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/components/pickers', () => ({
  PractitionerPicker: ({ ariaLabel }: { ariaLabel?: string }) => (
    <div data-testid="practitioner-picker" aria-label={ariaLabel} />
  ),
  OrganisationPicker: ({ ariaLabel }: { ariaLabel?: string }) => (
    <div data-testid="organisation-picker" aria-label={ariaLabel} />
  ),
}))

const ORG_ID = '00000000-0000-0000-0000-000000000010'
const PRACT_ID = '00000000-0000-0000-0000-000000000020'

const openRow: PractitionerRoleRead = {
  id: 'r-open',
  practitioner_id: PRACT_ID,
  organisation_id: ORG_ID,
  code: 'gp',
  specialty: 'Cardio',
  is_primary: true,
  period_start: '2026-01-01T00:00:00Z',
  period_end: null,
  practitioner: {
    id: PRACT_ID,
    user_id: 'u-1',
    display_name: 'Dr. Open',
    family_name: 'Open',
    given_name: 'Dr.',
  },
}

const closedRow: PractitionerRoleRead = {
  ...openRow,
  id: 'r-closed',
  is_primary: false,
  period_end: '2026-04-01T00:00:00Z',
  practitioner: { ...openRow.practitioner!, display_name: 'Dr. Closed' },
}

function renderPage(initialPath: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )
  const rootRoute = createRootRoute({
    component: () => (
      <Wrap>
        <PractitionerRoleListPage />
      </Wrap>
    ),
  })
  const childRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/admin/practitioner-roles',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([childRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  render(<RouterProvider router={router as unknown as AnyRouter} />)
  return { router }
}

describe('PractitionerRoleListPage', () => {
  beforeEach(() => {
    usePaginatedQueryMock.mockReset()
    useOrganisationsMock.mockReset()
    useRouteSearchTableStateMock.mockReset()
    useClosePractitionerRoleMock.mockReset()
    setFilterSpy.mockReset()
    clearFilterSpy.mockReset()

    useOrganisationsMock.mockReturnValue({
      data: [
        {
          id: ORG_ID,
          parent_organisation_id: null,
          name: 'Zas Hospital',
          type_code: 'prov',
          type_system: 'http://terminology.hl7.org/CodeSystem/organization-type',
          type_display: 'Healthcare Provider',
          sort_index: 0,
        },
      ],
    })

    useRouteSearchTableStateMock.mockReturnValue([
      { page: 1, pageSize: 25, q: null, orderBy: null, order: 'asc', filters: {} },
      {
        setSearch: vi.fn(),
        setFilter: setFilterSpy,
        clearFilter: clearFilterSpy,
        clearAll: vi.fn(),
        setPage: vi.fn(),
        setPageSize: vi.fn(),
        reset: vi.fn(),
      },
    ])
    useClosePractitionerRoleMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
    usePaginatedQueryMock.mockReturnValue({
      data: { items: [openRow, closedRow], page: 1, page_size: 25, total: 2, total_pages: 1 },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it('prefills filters from ?practitioner_id and ?organisation_id deep-link search params', async () => {
    renderPage(`/admin/practitioner-roles?practitioner_id=${PRACT_ID}&organisation_id=${ORG_ID}`)
    await waitFor(() =>
      expect(setFilterSpy).toHaveBeenCalledWith('practitioner_id', { op: 'eq', value: PRACT_ID }),
    )
    await waitFor(() =>
      expect(setFilterSpy).toHaveBeenCalledWith('organisation_id', { op: 'eq', value: ORG_ID }),
    )
  })

  it('open-row kebab exposes both "Bewerken" and "Beëindigen"', async () => {
    renderPage('/admin/practitioner-roles')
    await screen.findByText('Dr. Open')
    const kebabs = screen.getAllByRole('button', { name: /open menu|acties|row actions/i })
    // rows render in fixture order: [openRow, closedRow]
    await userEvent.click(kebabs[0]!)
    expect(await screen.findByRole('menuitem', { name: /bewerken/i })).toBeTruthy()
    expect(await screen.findByRole('menuitem', { name: /beëindigen/i })).toBeTruthy()
  })

  it('closed-row kebab does not expose "Beëindigen"', async () => {
    renderPage('/admin/practitioner-roles')
    await screen.findByText('Dr. Closed')
    const kebabs = screen.getAllByRole('button', { name: /open menu|acties|row actions/i })
    await userEvent.click(kebabs[1]!)
    await screen.findByRole('menuitem', { name: /bekijken/i })
    expect(screen.queryByRole('menuitem', { name: /beëindigen/i })).toBeNull()
  })
})
