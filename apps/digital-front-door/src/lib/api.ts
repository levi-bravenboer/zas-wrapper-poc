import Constants from 'expo-constants'

import { log } from '@/lib/logger'

export type ApiHealth = {
  status: 'ok'
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function readBaseUrlFromExtra(): string | null {
  const extra = Constants.expoConfig?.extra
  if (extra && typeof extra === 'object' && 'apiBaseUrl' in extra) {
    const value = extra.apiBaseUrl
    if (typeof value === 'string') return value
  }
  return null
}

function resolveBaseUrl(): string {
  const fromExtra = readBaseUrlFromExtra()
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL
  const value = fromExtra ?? fromEnv ?? null
  if (!value) {
    throw new ApiError(
      'EXPO_PUBLIC_API_BASE_URL is not set — copy `.env.example` to `.env` first.',
      0
    )
  }
  return value.replace(/\/+$/, '')
}

function isApiHealth(value: unknown): value is ApiHealth {
  if (typeof value !== 'object' || value === null) return false
  if (!('status' in value)) return false
  return value.status === 'ok'
}

export class UnauthenticatedError extends ApiError {
  constructor() {
    super('Unauthenticated', 401)
    this.name = 'UnauthenticatedError'
  }
}

export function resolveTenantSlug(): string {
  const extra = Constants.expoConfig?.extra
  if (extra && typeof extra === 'object' && 'tenantSlug' in extra) {
    const value = extra.tenantSlug
    if (typeof value === 'string') return value
  }
  throw new ApiError(
    'EXPO_PUBLIC_TENANT_SLUG is not set — copy `.env.example` to `.env` first.',
    0
  )
}

const DEFAULT_TIMEOUT_MS = 8000

export async function requestAuthed<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${resolveBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...init.headers },
    signal: init.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  })
  if (res.status === 401) throw new UnauthenticatedError()
  if (!res.ok)
    throw new ApiError(`Request failed (${res.status})`, res.status)
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generic fetch wrapper
  return (await res.json()) as T
}

export async function apiHealthCheck(): Promise<ApiHealth> {
  const url = `${resolveBaseUrl()}/mobile/health`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ApiError(
        `Health check timed out after ${DEFAULT_TIMEOUT_MS}ms`,
        0
      )
    }
    throw err
  }
  if (!res.ok) {
    throw new ApiError(`Health check failed (${res.status})`, res.status)
  }
  const body: unknown = await res.json()
  if (!isApiHealth(body)) {
    throw new ApiError('Unexpected health response shape', 0)
  }
  log.info('[api] health', body)
  return body
}
