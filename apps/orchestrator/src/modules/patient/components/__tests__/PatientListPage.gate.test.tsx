import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { PatientListPage } from '../PatientListPage'

const { useCanMock } = vi.hoisted(() => ({ useCanMock: vi.fn() }))

vi.mock('@/modules/auth/permissions', () => ({ useCan: useCanMock }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@/hooks/use-paginated-query', () => ({
  usePaginatedQuery: () => ({
    data: { items: [], total_pages: 1 },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
}))
vi.mock('@/hooks/use-route-search-table-state', () => ({
  useRouteSearchTableState: () => [
    { page: 1, pageSize: 20, q: '', orderBy: undefined, order: undefined, filters: {} },
    {
      setSearch: vi.fn(),
      clearAll: vi.fn(),
      reset: vi.fn(),
      setPage: vi.fn(),
      setPageSize: vi.fn(),
    },
  ],
}))
// Keep the dialog inert so it doesn't pull in org-list queries.
vi.mock('../CreatePatientDialog', () => ({ CreatePatientDialog: () => null }))

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )
  render(
    <Wrap>
      <PatientListPage />
    </Wrap>,
  )
}

describe('PatientListPage create gate', () => {
  beforeEach(() => useCanMock.mockReset())

  it('hides the create button without patient.create', () => {
    useCanMock.mockReturnValue(false)
    renderPage()
    expect(screen.queryByRole('button', { name: /Patiënt aanmaken/ })).not.toBeInTheDocument()
  })

  it('shows the create button with patient.create', () => {
    useCanMock.mockImplementation((cap: string) => cap === 'patient.create')
    renderPage()
    expect(screen.getByRole('button', { name: /Patiënt aanmaken/ })).toBeInTheDocument()
  })
})
