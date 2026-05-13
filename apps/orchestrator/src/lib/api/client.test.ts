import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import { server } from '@/mocks/server'

import { api } from './client'

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

describe('api client 401 retry', () => {
  afterEach(() => server.resetHandlers())

  it('retries once after a 401 by probing /auth/me, then succeeds', async () => {
    let count = 0
    let probed = false

    server.use(
      http.get(`${baseUrl}/auth/me`, () => {
        probed = true
        return HttpResponse.json({ id: 'u', email: 'x@y.z', displayName: 'X', roles: [] })
      }),
      http.get(`${baseUrl}/healthz`, ({ request }) => {
        count++
        if (request.headers.get('x-retry') === '1') {
          return HttpResponse.json({ ok: true })
        }
        return HttpResponse.json({ detail: 'unauthorized' }, { status: 401 })
      }),
    )

    // openapi-fetch's typed surface won't know /healthz; use raw GET to exercise middleware
    const res = await fetch(`${baseUrl}/healthz`, { credentials: 'include' })
    expect(res.status).toBe(401)
    // Now exercise via api client middleware
    type Healthz = { ok: boolean }
    const middlewareRes = await (
      api as unknown as {
        GET: (
          url: string,
          opts?: Record<string, unknown>,
        ) => Promise<{ response: Response; data?: Healthz }>
      }
    ).GET('/healthz')

    expect(count).toBeGreaterThanOrEqual(2)
    expect(probed).toBe(true)
    expect(middlewareRes.response.status).toBe(200)
  })

  it('does not retry on a 2xx response', async () => {
    let count = 0
    server.use(
      http.get(`${baseUrl}/healthz`, () => {
        count++
        return HttpResponse.json({ ok: true })
      }),
    )

    type Healthz = { ok: boolean }
    const res = await (
      api as unknown as {
        GET: (url: string) => Promise<{ response: Response; data?: Healthz }>
      }
    ).GET('/healthz')

    expect(count).toBe(1)
    expect(res.response.status).toBe(200)
  })

  it('does not retry a 401 on /auth/me itself', async () => {
    let count = 0
    server.use(
      http.get(`${baseUrl}/auth/me`, () => {
        count++
        return HttpResponse.json({ detail: 'no' }, { status: 401 })
      }),
    )

    type Me = { id: string }
    const res = await (
      api as unknown as {
        GET: (url: string) => Promise<{ response: Response; data?: Me }>
      }
    ).GET('/auth/me')

    expect(count).toBe(1)
    expect(res.response.status).toBe(401)
  })
})
