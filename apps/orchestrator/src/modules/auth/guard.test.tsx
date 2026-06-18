import { QueryClient } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import { env } from '@/config/env'
import { server } from '@/mocks/server'

import { requireSession } from './guard'
import { authKeys } from './keys'

const baseUrl = env.API_BASE_URL

const STUB_USER = {
  id: 'u1',
  email: 'a@b.co',
  display_name: 'A',
  tenant_id: '00000000-0000-0000-0000-000000000001',
  role_id: 'd2222222-2222-4222-8222-2222222222d1',
  role_slug: 'default',
  permissions: [],
  patient_id: null,
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

  it('treats a server-side revoked session as logged out once stale', async () => {
    // access-management-ory: sessions can die server-side (Kratos revocation
    // on logout-elsewhere / deactivation) — a previously-valid session that
    // starts answering 401 must resolve to null, not an error.
    let revoked = false
    server.use(
      http.get(`${baseUrl}/auth/me`, () =>
        revoked
          ? HttpResponse.json({ code: 'security.auth.unauthenticated' }, { status: 401 })
          : HttpResponse.json(STUB_USER),
      ),
    )
    const qc = makeClient()

    const before = await requireSession(qc)
    expect(before?.id).toBe('u1')

    revoked = true
    qc.removeQueries({ queryKey: authKeys.me() })
    const after = await requireSession(qc)

    expect(after).toBeNull()
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
