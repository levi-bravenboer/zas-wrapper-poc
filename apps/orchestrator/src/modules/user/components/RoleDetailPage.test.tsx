import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { env } from '@/config/env'
import { server } from '@/mocks/server'
import { renderWithRoutes } from '@/test/renderWithRoutes'

import { RoleDetailPage } from './RoleDetailPage'

vi.mock('@/modules/auth/permissions', () => ({
  useCan: () => true,
  useCanAny: () => true,
  can: () => true,
}))

const baseUrl = env.API_BASE_URL

const ROLE_ID = '22222222-2222-4222-8222-222222222222'

const customRole = {
  id: ROLE_ID,
  slug: 'nurse',
  name: 'Verpleegkundige',
  is_system: false,
  permissions: ['user.read', 'user.create', 'role.update'],
}

function serveRole(role: unknown): void {
  server.use(http.get(`${baseUrl}/roles/${ROLE_ID}`, () => HttpResponse.json(role)))
}

function renderDetail(): void {
  renderWithRoutes(<RoleDetailPage roleId={ROLE_ID} />, {
    routes: ['/admin/roles', '/admin/roles/$roleId/edit'],
  })
}

describe('RoleDetailPage', () => {
  it('renders the role identity, permission count and grouped permission verbs', async () => {
    serveRole(customRole)
    renderDetail()

    // Name renders in both the page title and the detail card.
    expect((await screen.findAllByText('Verpleegkundige')).length).toBeGreaterThan(0)
    // Permissions grouped by resource → verb badges.
    expect(screen.getByText('read')).toBeInTheDocument()
    expect(screen.getByText('create')).toBeInTheDocument()
    expect(screen.getByText('update')).toBeInTheDocument()
    // Permission count (3).
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('offers an edit action linking to the role edit route', async () => {
    serveRole(customRole)
    renderDetail()
    await screen.findAllByText('Verpleegkundige')
    const editLink = screen.getByRole('link', { name: /bewerken/i })
    expect(editLink).toHaveAttribute('href', `/admin/roles/${ROLE_ID}/edit`)
  })
})
