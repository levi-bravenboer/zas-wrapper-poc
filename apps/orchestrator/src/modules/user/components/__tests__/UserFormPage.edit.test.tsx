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

import { UserFormPage } from '../UserFormPage'

const { createUserMock, updateUserDemographicsMock } = vi.hoisted(() => ({
  createUserMock: vi.fn(),
  updateUserDemographicsMock: vi.fn(),
}))

vi.mock('../../api', () => ({
  createUser: createUserMock,
  updateUserDemographics: updateUserDemographicsMock,
}))

const USER_ID = 'u-care-1'

function renderEdit(): { router: AnyRouter } {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
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
      role: 'caregiver',
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
