import { env } from '@/config/env'

import { type LoginRequest, sessionUserSchema, type SessionUser } from './schemas'

const baseUrl = env.API_BASE_URL

export class AuthError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

export async function login(input: LoginRequest): Promise<SessionUser> {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    throw new AuthError('Login failed', res.status)
  }
  return sessionUserSchema.parse(await res.json())
}

export async function logout(): Promise<void> {
  const res = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) {
    throw new AuthError('Logout failed', res.status)
  }
}

export async function fetchSession(): Promise<SessionUser | null> {
  const res = await fetch(`${baseUrl}/auth/me`, {
    credentials: 'include',
  })
  if (res.status === 401) return null
  if (!res.ok) {
    throw new AuthError('Session fetch failed', res.status)
  }
  return sessionUserSchema.parse(await res.json())
}
