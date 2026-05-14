import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'

import { env } from '@/config/env'
import { server } from '@/mocks/server'

import { api, retryOn401Logic } from './client'

const baseUrl = env.API_BASE_URL

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

    const raw = await fetch(`${baseUrl}/healthz`, { credentials: 'include' })
    expect(raw.status).toBe(401)

    const middlewareRes = await api.GET('/healthz')

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

    const res = await api.GET('/healthz')

    expect(count).toBe(1)
    expect(res.response.status).toBe(200)
  })

  it('does not retry when the failing request itself targets /auth/me', async () => {
    const response = new Response(JSON.stringify({ detail: 'no' }), { status: 401 })
    const request = new Request(`${baseUrl}/auth/me`)

    const retried = await retryOn401Logic(response, request)

    expect(retried).toBeUndefined()
  })

  it('does not retry when the request was already retried (x-retry header set)', async () => {
    const response = new Response(JSON.stringify({ detail: 'no' }), { status: 401 })
    const request = new Request(`${baseUrl}/healthz`, {
      headers: { 'x-retry': '1' },
    })

    const retried = await retryOn401Logic(response, request)

    expect(retried).toBeUndefined()
  })

  it('passes through non-401 responses without action', async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 })
    const request = new Request(`${baseUrl}/healthz`)

    const retried = await retryOn401Logic(response, request)

    expect(retried).toBeUndefined()
  })

  it('coalesces concurrent 401s into a single /auth/me probe', async () => {
    let probes = 0
    let count = 0
    server.use(
      http.get(`${baseUrl}/auth/me`, () => {
        probes++
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

    const [a, b] = await Promise.all([api.GET('/healthz'), api.GET('/healthz')])

    expect(a.response.status).toBe(200)
    expect(b.response.status).toBe(200)
    expect(probes).toBe(1)
    expect(count).toBeGreaterThanOrEqual(4)
  })
})
