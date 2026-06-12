/* eslint-disable testing-library/no-node-access --
   asserts on the aria-controls target which has no Testing Library equivalent. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'
import { i18n } from '@/lib/i18n'
import { authKeys } from '@/modules/auth/keys'
import type { SessionUser } from '@/modules/auth/schemas'

import { AppSidebar } from '../AppSidebar'

function mountSidebar(role: SessionUser['role'] | null): { queryClient: QueryClient } {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (role) {
    queryClient.setQueryData<SessionUser>(authKeys.me(), {
      id: 'u1',
      email: 'a@b.co',
      display_name: 'A',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      role,
    })
  }

  function Harness(): ReactElement {
    return (
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    )
  }

  const rootRoute = createRootRoute({ component: Harness })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nextProvider>,
  )

  return { queryClient }
}

describe('AppSidebar — role-gated Beheer group', () => {
  it('hides the Beheer group for caregivers', async () => {
    mountSidebar('caregiver')
    expect(await screen.findByRole('link', { name: 'Taken' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Beheer/i })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Gebruikers' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Organisaties' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Affiliaties' })).toBeNull()
  })

  it('renders the Beheer group expanded for admins with three child entries', async () => {
    mountSidebar('admin')
    const toggle = await screen.findByRole('button', { name: /Beheer/i })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    const beheer = document.getElementById('nav-group-beheer')
    expect(beheer).not.toBeNull()
    expect(within(beheer!).getByRole('link', { name: 'Gebruikers' })).toBeTruthy()
    expect(within(beheer!).getByRole('link', { name: 'Organisaties' })).toBeTruthy()
    expect(within(beheer!).getByRole('link', { name: 'Affiliaties' })).toBeTruthy()
  })
})
