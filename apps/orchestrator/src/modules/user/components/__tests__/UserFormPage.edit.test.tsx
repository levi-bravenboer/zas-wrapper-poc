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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import { userKeys } from '../../keys'
import { rolesKey, type Role } from '../../roles'
import type { UserDetail } from '../../schemas'
import { UserFormPage } from '../UserFormPage'

const DEFAULT_ROLE_ID = 'd2222222-2222-4222-8222-2222222222d1'

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

const USER_ID = 'u-care-1'

const USER_DETAIL: UserDetail = {
  id: USER_ID,
  email: 'sanne.jansen@zas.demo',
  display_name: 'Sanne Jansen',
  role_id: DEFAULT_ROLE_ID,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  external_idp: null,
  external_subject: null,
  updated_at: '2026-01-01T00:00:00Z',
}

const { createUserMock, updateUserDemographicsMock, fetchUserDetailMock } = vi.hoisted(() => ({
  createUserMock: vi.fn(),
  updateUserDemographicsMock: vi.fn(),
  fetchUserDetailMock: vi.fn(),
}))

vi.mock('../../api', () => ({
  createUser: createUserMock,
  updateUserDemographics: updateUserDemographicsMock,
  fetchUserDetail: fetchUserDetailMock,
}))

function renderEdit(): { router: AnyRouter } {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  qc.setQueryData(rolesKey, ROLES)
  qc.setQueryData(userKeys.detail(USER_ID), USER_DETAIL)
  qc.setQueryData(['practitioner', USER_ID], {
    id: 'p1111111-1111-4111-8111-1111111111p1',
    user_id: USER_ID,
    given_name: 'Sanne',
    family_name: 'Jansen',
    qualification: 'Huisarts',
    roles: [],
  })
  const Wrap = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </I18nextProvider>
  )
  const rootRoute = createRootRoute({
    component: () => (
      <Wrap>
        <UserFormPage mode="edit" userId={USER_ID} />
      </Wrap>
    ),
  })
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/admin/users/$userId',
    component: () => <div data-testid="detail">detail</div>,
  })
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/admin/users',
    component: () => <div data-testid="list">list</div>,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, listRoute, detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router as unknown as AnyRouter} />)
  return { router: router as unknown as AnyRouter }
}

describe('UserFormPage (edit mode)', () => {
  beforeEach(() => {
    createUserMock.mockReset()
    updateUserDemographicsMock.mockReset()
    fetchUserDetailMock.mockReset()
    fetchUserDetailMock.mockResolvedValue(USER_DETAIL)
  })

  it('locks email + role + given/family name inputs', async () => {
    renderEdit()
    const email = await screen.findByLabelText(/email/i)
    expect((email as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText(/voornaam/i) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText(/achternaam/i) as HTMLInputElement).disabled).toBe(true)
  })

  it('submits PATCH with derived display_name and navigates to detail', async () => {
    updateUserDemographicsMock.mockResolvedValue({
      id: USER_ID,
      email: 'sanne.jansen@zas.demo',
      display_name: 'Sanne Jansen',
      role_id: 'd2222222-2222-4222-8222-2222222222d1',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    })
    const { router } = renderEdit()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /opslaan|bijwerken/i }))

    await waitFor(() => expect(updateUserDemographicsMock).toHaveBeenCalledTimes(1))
    expect(updateUserDemographicsMock.mock.calls[0]?.[0]).toBe(USER_ID)
    expect(updateUserDemographicsMock.mock.calls[0]?.[1]).toEqual({ display_name: 'Sanne Jansen' })
    await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/users/${USER_ID}`))
  })
})
