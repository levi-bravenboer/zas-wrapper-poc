import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { env } from '@/config/env'
import { server } from '@/mocks/server'
import { renderWithRoutes } from '@/test/renderWithRoutes'

import { RolesListPage } from './RolesListPage'

// UI permission gating is presentation-only; the backend stays the source of
// truth. Grant everything so the affordances render.
vi.mock('@/modules/auth/permissions', () => ({
  useCan: () => true,
  useCanAny: () => true,
  can: () => true,
}))

const baseUrl = env.API_BASE_URL

const ADMIN_ROLE = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'admin',
  name: 'Admin',
  is_system: true,
  permissions: ['patient.accessAll', 'role.update'],
}
const NURSE_ROLE = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'nurse',
  name: 'Verpleegkundige',
  is_system: false,
  permissions: ['user.read'],
}

function serveRoles(roles: unknown[]): void {
  server.use(http.get(`${baseUrl}/roles`, () => HttpResponse.json(roles)))
}

function renderPage(): void {
  renderWithRoutes(<RolesListPage />, { routes: ['/admin/roles/new'] })
}

describe('RolesListPage', () => {
  it('lists roles with slug, permission count and a system badge', async () => {
    serveRoles([ADMIN_ROLE, NURSE_ROLE])
    renderPage()

    expect(await screen.findByText('Verpleegkundige')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('nurse')).toBeInTheDocument()
    // System role carries the "systeem" badge.
    expect(screen.getByText('systeem')).toBeInTheDocument()
    // Permission counts (admin: 2, nurse: 1).
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('exposes an inline edit affordance per row when the user can update', async () => {
    serveRoles([NURSE_ROLE])
    renderPage()
    await screen.findByText('Verpleegkundige')
    expect(screen.getByRole('button', { name: /bewerken/i })).toBeInTheDocument()
  })

  it('renders an empty state when there are no roles', async () => {
    serveRoles([])
    renderPage()
    expect(await screen.findByText('Geen rollen.')).toBeInTheDocument()
  })
})
