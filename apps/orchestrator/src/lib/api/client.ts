import createClient, { type Middleware } from 'openapi-fetch'

import { env } from '@/config/env'

import type { paths } from './schema'

const baseUrl = env.API_BASE_URL

let retryLock: Promise<void> | null = null

export async function retryOn401Logic(
  response: Response,
  request: Request,
  meUrl = `${baseUrl}/auth/me`,
): Promise<Response | undefined> {
  if (response.status !== 401) return undefined
  if (request.url.endsWith('/auth/me')) return undefined
  if (request.headers.get('x-retry') === '1') return undefined

  if (!retryLock) {
    retryLock = (async () => {
      await fetch(meUrl, { credentials: 'include' })
    })().finally(() => {
      retryLock = null
    })
  }
  await retryLock

  const retried = new Request(request, { headers: new Headers(request.headers) })
  retried.headers.set('x-retry', '1')
  return fetch(retried)
}

const retryOn401: Middleware = {
  async onResponse({ response, request }) {
    return retryOn401Logic(response, request)
  },
}

export const api = createClient<paths>({
  baseUrl,
  credentials: 'include',
})

api.use(retryOn401)

export type Api = typeof api
