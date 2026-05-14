import { QueryClient } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/mocks/server'

import { requireSession } from './guard'
import { authKeys } from './keys'

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:18000'

const STUB_USER = {
  id: 'u1',
  email: 'a@b.co',
  displayName: 'A',
  roles: ['clinician'],
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('requireSession', () => {
  it('returns the user from a 200 /auth/me', async () => {
    server.use(http.get(`${baseUrl}/auth/me`, () => HttpResponse.json(STUB_USER)))
    const qc = makeClient()

    const session = await requireSession(qc)

    expect(session?.id).toBe('u1')
  })

  it('returns null on 401', async () => {
    server.use(
      http.get(`${baseUrl}/auth/me`, () => HttpResponse.json({ detail: 'no' }, { status: 401 })),
    )
    const qc = makeClient()

    const session = await requireSession(qc)

    expect(session).toBeNull()
  })

  it('reuses the cached value within staleTime', async () => {
    let calls = 0
    server.use(
      http.get(`${baseUrl}/auth/me`, () => {
        calls += 1
        return HttpResponse.json(STUB_USER)
      }),
    )
    const qc = makeClient()

    await requireSession(qc)
    await requireSession(qc)

    expect(calls).toBe(1)
  })

  it('refetches when the cache entry is removed', async () => {
    let calls = 0
    server.use(
      http.get(`${baseUrl}/auth/me`, () => {
        calls += 1
        return HttpResponse.json(STUB_USER)
      }),
    )
    const qc = makeClient()

    await requireSession(qc)
    qc.removeQueries({ queryKey: authKeys.me() })
    await requireSession(qc)

    expect(calls).toBe(2)
  })
})
