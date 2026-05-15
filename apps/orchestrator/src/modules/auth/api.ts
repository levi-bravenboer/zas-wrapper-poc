import { api } from '@/lib/api/client'

import {
  type LoginRequest,
  providerDescriptorSchema,
  type ProviderDescriptor,
  sessionUserSchema,
  type SessionUser,
} from './schemas'

function authError(message: string, status: number): Error & { status: number } {
  const err = new Error(message) as Error & { status: number }
  err.status = status
  return err
}

export async function login(input: LoginRequest): Promise<SessionUser> {
  const result = await api.POST('/auth/login/password', { body: input })
  if (!result.data) {
    throw authError('Login failed', result.response.status)
  }
  return sessionUserSchema.parse(result.data)
}

export async function logout(): Promise<void> {
  const result = await api.POST('/auth/logout', {})
  if (!result.response.ok) {
    throw authError('Logout failed', result.response.status)
  }
}

export async function fetchSession(): Promise<SessionUser | null> {
  const result = await api.GET('/auth/me', {})
  if (result.response.status === 401) return null
  if (!result.data) {
    throw authError('Session fetch failed', result.response.status)
  }
  return sessionUserSchema.parse(result.data)
}

export async function fetchProviders(): Promise<ProviderDescriptor[]> {
  const result = await api.GET('/auth/providers', {})
  if (!result.data) {
    throw authError('Providers fetch failed', result.response.status)
  }
  return result.data.map((entry) => providerDescriptorSchema.parse(entry))
}
