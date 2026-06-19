import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { env } from '@/config/env'
import { server } from '@/mocks/server'
import { renderWithRoutes } from '@/test/renderWithRoutes'

import { RoleFormPage } from './RoleFormPage'

// The actor holds user.* but NOT role.update — drives the no-amplification gate.
vi.mock('@/modules/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: ['user.read', 'user.create'] } }),
}))

const baseUrl = env.API_BASE_URL

const CATALOG = ['user.read', 'user.create', 'role.update']

function servePermissions(): void {
  server.use(http.get(`${baseUrl}/permissions`, () => HttpResponse.json(CATALOG)))
}

function renderCreate(): void {
  renderWithRoutes(<RoleFormPage mode="create" />, { routes: ['/admin/roles'] })
}

describe('RoleFormPage (create)', () => {
  it('renders the name + slug fields and the permission catalogue grouped by resource', async () => {
    servePermissions()
    renderCreate()

    expect(await screen.findByText('read')).toBeInTheDocument()
    // Name + slug inputs are present.
    expect(screen.getByLabelText('Naam')).toBeInTheDocument()
    expect(screen.getByLabelText('Slug')).toBeInTheDocument()
    // One checkbox per catalogue permission.
    expect(screen.getAllByRole('checkbox')).toHaveLength(CATALOG.length)
  })

  it('locks a permission the actor does not hold (no-amplification)', async () => {
    servePermissions()
    renderCreate()
    await screen.findByText('update')

    // role.update is not in the actor's permission set → its checkbox is disabled.
    const disabled = screen.getAllByRole('checkbox').filter((c) => c.hasAttribute('data-disabled'))
    expect(disabled).toHaveLength(1)
  })
})
