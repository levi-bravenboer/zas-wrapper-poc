import { QueryClient } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/mocks/server'

import { Route as AuthRoute } from './_auth'

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:18000'

function makeContext() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return { queryClient }
}

describe('_auth beforeLoad', () => {
  it('throws a redirect to /login when no session', async () => {
    server.use(
      http.get(`${baseUrl}/auth/me`, () => HttpResponse.json({ detail: 'no' }, { status: 401 })),
    )

    const beforeLoad = AuthRoute.options.beforeLoad
    if (!beforeLoad) throw new Error('beforeLoad missing')

    await expect(
      beforeLoad({
        context: makeContext(),
        location: { href: '/dashboard' },
      } as Parameters<typeof beforeLoad>[0]),
    ).rejects.toMatchObject({
      options: {
        to: '/login',
        search: { redirect: '/dashboard' },
      },
    })
  })

  it('returns the session when /auth/me is 200', async () => {
    server.use(
      http.get(`${baseUrl}/auth/me`, () =>
        HttpResponse.json({
          id: 'u1',
          email: 'a@b.co',
          displayName: 'A',
          roles: ['clinician'],
        }),
      ),
    )

    const beforeLoad = AuthRoute.options.beforeLoad
    if (!beforeLoad) throw new Error('beforeLoad missing')

    const result = await beforeLoad({
      context: makeContext(),
      location: { href: '/dashboard' },
    } as Parameters<typeof beforeLoad>[0])

    expect(result).toMatchObject({ session: { id: 'u1' } })
  })
})
