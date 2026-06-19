import { QueryClient } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import { env } from '@/config/env'
import { server } from '@/mocks/server'

import { adminBeforeLoad } from './route'

const baseUrl = env.API_BASE_URL

function makeContext(): { queryClient: QueryClient } {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return { queryClient }
}

describe('admin route beforeLoad', () => {
  it('redirects caregivers to /', async () => {
    server.use(
      http.get(`${baseUrl}/auth/me`, () =>
        HttpResponse.json({
          id: 'u1',
          email: 'a@b.co',
          display_name: 'A',
          tenant_id: '00000000-0000-0000-0000-000000000001',
          role_id: 'd2222222-2222-4222-8222-2222222222d1',
          role_slug: 'default',
          permissions: [],
          patient_id: null,
        }),
      ),
    )

    await expect(adminBeforeLoad({ context: makeContext() })).rejects.toMatchObject({
      options: { to: '/' },
    })
  })

  it('redirects external users to /', async () => {
    server.use(
      http.get(`${baseUrl}/auth/me`, () =>
        HttpResponse.json({
          id: 'u2',
          email: 'b@b.co',
          display_name: 'B',
          tenant_id: '00000000-0000-0000-0000-000000000001',
          role_id: 'e3333333-3333-4333-8333-3333333333e3',
          role_slug: 'external',
          permissions: [],
          patient_id: null,
        }),
      ),
    )

    await expect(adminBeforeLoad({ context: makeContext() })).rejects.toMatchObject({
      options: { to: '/' },
    })
  })

  it('returns the session for admins', async () => {
    server.use(
      http.get(`${baseUrl}/auth/me`, () =>
        HttpResponse.json({
          id: 'u3',
          email: 'c@b.co',
          display_name: 'C',
          tenant_id: '00000000-0000-0000-0000-000000000001',
          role_id: 'a1111111-1111-4111-8111-1111111111a1',
          role_slug: 'admin',
          permissions: ['user.read', 'role.read', 'organisation.read', 'audit.read'],
          patient_id: null,
        }),
      ),
    )

    const result = await adminBeforeLoad({ context: makeContext() })
    expect(result).toMatchObject({ session: { id: 'u3', role_slug: 'admin' } })
  })
})
