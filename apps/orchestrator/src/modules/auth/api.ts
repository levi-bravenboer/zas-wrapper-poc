import { api } from '@/lib/api/client'
import { apiError } from '@/lib/api/errors'

import {
  type LoginRequest,
  providerDescriptorSchema,
  type ProviderDescriptor,
  sessionUserSchema,
  type SessionUser,
} from './schemas'

export async function login(input: LoginRequest): Promise<SessionUser> {
  const result = await api.POST('/auth/login/password', { body: input })
  if (!result.data) {
    throw apiError('Login failed', result.response.status)
  }
  return sessionUserSchema.parse(result.data)
}

export async function logout(): Promise<void> {
  const result = await api.POST('/auth/logout', {})
  if (!result.response.ok) {
    throw apiError('Logout failed', result.response.status)
  }
}

export async function fetchSession(): Promise<SessionUser | null> {
  const result = await api.GET('/auth/me', {})
  if (result.response.status === 401) return null
  if (!result.data) {
    throw apiError('Session fetch failed', result.response.status)
  }
  return sessionUserSchema.parse(result.data)
}

export async function fetchProviders(): Promise<ProviderDescriptor[]> {
  const result = await api.GET('/auth/providers', {})
  if (!result.data) {
    throw apiError('Providers fetch failed', result.response.status)
  }
  return result.data.map((entry) => providerDescriptorSchema.parse(entry))
}
