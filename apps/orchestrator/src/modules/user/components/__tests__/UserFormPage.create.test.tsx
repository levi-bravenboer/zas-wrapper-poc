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

import { apiError } from '@/lib/api/errors'
import { i18n } from '@/lib/i18n'

import { rolesKey, type Role } from '../../roles'
import { UserFormPage } from '../UserFormPage'

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

const { createUserMock, updateUserDemographicsMock } = vi.hoisted(() => ({
  createUserMock: vi.fn(),
  updateUserDemographicsMock: vi.fn(),
}))

vi.mock('../../api', () => ({
  createUser: createUserMock,
  updateUserDemographics: updateUserDemographicsMock,
}))

function renderPage(): { router: AnyRouter } {
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
        <UserFormPage mode="create" />
      </Wrap>
    ),
  })
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/admin/users',
    component: () => <div data-testid="list">list</div>,
  })
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/admin/users/$userId',
    component: () => <div data-testid="detail">detail</div>,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, listRoute, detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    defaultErrorComponent: ({ error }) => <pre data-testid="router-err">{String(error)}</pre>,
  })
  render(<RouterProvider router={router as unknown as AnyRouter} />)
  return { router: router as unknown as AnyRouter }
}

describe('UserFormPage (create mode)', () => {
  beforeEach(() => {
    createUserMock.mockReset()
    updateUserDemographicsMock.mockReset()
  })

  it('shows qualification field when role is caregiver (default)', async () => {
    renderPage()
    expect(await screen.findByLabelText(/kwalificatie/i)).toBeTruthy()
  })

  it('renders a password field in create mode', async () => {
    renderPage()
    const password = await screen.findByLabelText(/wachtwoord/i)
    expect(password).toBeTruthy()
    expect(password.getAttribute('type')).toBe('password')
  })

  it('blocks submit and shows an error when password is too short', async () => {
    const { router } = renderPage()
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText(/voornaam/i), 'Eva')
    await user.type(screen.getByLabelText(/achternaam/i), 'Bos')
    await user.type(screen.getByLabelText(/e-mail/i), 'eva@zas.demo')
    await user.type(screen.getByLabelText(/wachtwoord/i), 'short')
    await user.click(screen.getByRole('button', { name: /aanmaken|opslaan/i }))

    await screen.findByText(/minimaal 8 tekens/i)
    expect(createUserMock).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/')
  })

  it('surfaces 409 duplicate-email inline and keeps route mounted', async () => {
    createUserMock.mockRejectedValue(apiError('Email exists', 409, 'conflict.user.email_exists'))

    const { router } = renderPage()
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText(/voornaam/i), 'Eva')
    await user.type(screen.getByLabelText(/achternaam/i), 'Bos')
    await user.type(screen.getByLabelText(/e-mail/i), 'dup@zas.demo')
    await user.type(screen.getByLabelText(/wachtwoord/i), 's3cret-pw')
    await user.click(screen.getByRole('button', { name: /aanmaken|opslaan/i }))

    await waitFor(() => expect(createUserMock).toHaveBeenCalled())
    await screen.findByText(/al in gebruik|bestaat al|already/i)
    expect(router.state.location.pathname).toBe('/')
  })

  it('includes the password in the create payload and navigates on success', async () => {
    createUserMock.mockResolvedValue({
      id: 'new-id',
      email: 'eva@zas.demo',
      display_name: 'Eva Bos',
      role_id: 'd2222222-2222-4222-8222-2222222222d1',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    })

    const { router } = renderPage()
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/voornaam/i), 'Eva')
    await user.type(screen.getByLabelText(/achternaam/i), 'Bos')
    await user.type(screen.getByLabelText(/e-mail/i), 'eva@zas.demo')
    await user.type(screen.getByLabelText(/wachtwoord/i), 's3cret-pw')
    await user.click(screen.getByRole('button', { name: /aanmaken|opslaan/i }))

    await waitFor(() => expect(createUserMock).toHaveBeenCalled())
    expect(createUserMock.mock.calls[0]?.[0]).toMatchObject({ password: 's3cret-pw' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/users/new-id'))
  })
})
