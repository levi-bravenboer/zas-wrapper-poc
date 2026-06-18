import { QueryClient } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import { env } from '@/config/env'
import { server } from '@/mocks/server'

import { authBeforeLoad } from './_auth'

const baseUrl = env.API_BASE_URL

function makeContext() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return { queryClient }
}

describe('_auth beforeLoad', () => {
  it('throws a redirect to /login when no session', async () => {
    server.use(
      http.get(`${baseUrl}/auth/me`, () => HttpResponse.json({ detail: 'no' }, { status: 401 })),
    )

    await expect(
      authBeforeLoad({
        context: makeContext(),
        location: { href: '/' },
      }),
    ).rejects.toMatchObject({
      options: {
        to: '/login',
        search: { redirect: '/' },
      },
    })
  })

  it('returns the session when /auth/me is 200', async () => {
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

    const result = await authBeforeLoad({
      context: makeContext(),
      location: { href: '/' },
    })

    expect(result).toMatchObject({ session: { id: 'u1' } })
  })
})
