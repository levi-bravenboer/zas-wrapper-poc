import createClient, { type Middleware } from 'openapi-fetch'

import type { paths } from './schema'

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

let retryLock: Promise<void> | null = null

const retryOn401: Middleware = {
  async onResponse({ response, request }) {
    if (response.status !== 401) return undefined
    // never retry the /auth/me probe itself
    if (request.url.endsWith('/auth/me')) return undefined
    if (request.headers.get('x-retry') === '1') return undefined

    if (!retryLock) {
      retryLock = (async () => {
        await fetch(`${baseUrl}/auth/me`, { credentials: 'include' })
      })().finally(() => {
        retryLock = null
      })
    }
    await retryLock

    const retried = new Request(request, { headers: new Headers(request.headers) })
    retried.headers.set('x-retry', '1')
    return fetch(retried)
  },
}

export const api = createClient<paths>({
  baseUrl,
  credentials: 'include',
})

api.use(retryOn401)

export type Api = typeof api
