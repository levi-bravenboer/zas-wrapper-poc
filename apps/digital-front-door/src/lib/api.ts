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

const DEFAULT_TIMEOUT_MS = 8000

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
