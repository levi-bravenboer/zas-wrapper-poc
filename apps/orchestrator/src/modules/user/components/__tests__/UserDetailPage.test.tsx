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

import { rolesKey, type Role } from '../../roles'
import { UserDetailPage } from '../UserDetailPage'

const ROLES: Role[] = [
  {
    id: 'd2222222-2222-4222-8222-2222222222d1',
    slug: 'default',
    name: 'Standaard',
    is_system: true,
    permissions: [],
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'a1111111-1111-4111-8111-1111111111a1',
    slug: 'admin',
    name: 'Admin',
    is_system: true,
    permissions: [],
    created_at: '2026-01-01T00:00:00Z',
  },
]

const { getMock, useUserDetailMock, useSetUserActiveMock, useSessionMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  useUserDetailMock: vi.fn(),
  useSetUserActiveMock: vi.fn(),
  useSessionMock: vi.fn(),
}))

vi.mock('@/lib/api/client', () => ({
  api: { GET: getMock },
}))
vi.mock('../../hooks', () => ({
  useUserDetail: useUserDetailMock,
  useSetUserActive: useSetUserActiveMock,
}))
vi.mock('@/modules/auth/hooks', () => ({
  useSession: useSessionMock,
}))

const ADMIN_USER = {
  id: 'u-admin',
  email: 'admin@zas.demo',
  display_name: 'Bo de Vries',
  role_id: 'a1111111-1111-4111-8111-1111111111a1',
  is_active: true,
  external_idp: null,
  external_subject: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const CAREGIVER_USER = {
  ...ADMIN_USER,
  id: 'u-care',
  email: 'eva@zas.demo',
  display_name: 'Eva Bos',
  role_id: 'd2222222-2222-4222-8222-2222222222d1',
}

const PRACTITIONER = {
  id: 'p-1',
  user_id: 'u-care',
  family_name: 'Bos',
  given_name: 'Eva',
  qualification: 'Huisarts',
  roles: [
    {
      id: 'pr-open',
      practitioner_id: 'p-1',
      organisation_id: 'org-1',
      code: 'PR-001',
      is_primary: true,
      period_start: '2026-01-01T00:00:00Z',
      period_end: null,
    },
    {
      id: 'pr-closed',
      practitioner_id: 'p-1',
      organisation_id: 'org-2',
      code: 'PR-002',
      is_primary: false,
      period_start: '2025-01-01T00:00:00Z',
      period_end: '2025-12-31T00:00:00Z',
    },
  ],
}

function renderPage(userId: string): { router: AnyRouter } {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  qc.setQueryData(rolesKey, ROLES)
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )

  const rootRoute = createRootRoute({
    component: () => (
      <Wrap>
        <UserDetailPage userId={userId} />
      </Wrap>
    ),
  })
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/admin/users',
    component: () => <div data-testid="list">list</div>,
  })
  const editRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/admin/users/$userId/edit',
    component: () => <div data-testid="edit">edit</div>,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <div data-testid="root" />,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, listRoute, editRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router as unknown as AnyRouter} />)
  return { router: router as unknown as AnyRouter }
}

function stubQuery<T>(data: T) {
  return {
    data,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }
}

describe('UserDetailPage', () => {
  beforeEach(() => {
    getMock.mockReset()
    useUserDetailMock.mockReset()
    useSetUserActiveMock.mockReset()
    useSessionMock.mockReset()
    useSetUserActiveMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
    useSessionMock.mockReturnValue({ data: { id: 'someone-else' } })
  })

  it('hides Practitioner card for admin role', async () => {
    useUserDetailMock.mockReturnValue(stubQuery(ADMIN_USER))
    getMock.mockResolvedValue({
      data: null,
      response: new Response(null, { status: 404 }),
    })
    renderPage(ADMIN_USER.id)
    await screen.findByRole('heading', { level: 1, name: ADMIN_USER.display_name })
    expect(screen.queryByText(/practitioner/i)).toBeNull()
    expect(screen.queryByText('Huisarts')).toBeNull()
  })

  it('shows open + closed PractitionerRole rows for caregiver', async () => {
    useUserDetailMock.mockReturnValue(stubQuery(CAREGIVER_USER))
    getMock.mockResolvedValue({
      data: PRACTITIONER,
      response: new Response(JSON.stringify(PRACTITIONER), { status: 200 }),
    })
    renderPage(CAREGIVER_USER.id)
    expect(await screen.findByText('Huisarts')).toBeTruthy()
    expect(screen.getByText('PR-001')).toBeTruthy()
    expect(screen.getByText('PR-002')).toBeTruthy()
    expect(screen.getByText(/2026-01-01/)).toBeTruthy()
  })

  it('disables Deactiveren for the current admin own row', async () => {
    useUserDetailMock.mockReturnValue(stubQuery(ADMIN_USER))
    useSessionMock.mockReturnValue({ data: { id: ADMIN_USER.id } })
    getMock.mockResolvedValue({
      data: null,
      response: new Response(null, { status: 404 }),
    })
    renderPage(ADMIN_USER.id)
    const btn = (await screen.findAllByRole('button')).find((b) =>
      b.textContent?.toLowerCase().includes('deactiveren'),
    )
    expect(btn).toBeTruthy()
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })
})
