import { api } from '@/lib/api/client'
import { apiError } from '@/lib/api/errors'

import {
  type LoginRequest,
  type LoginResult,
  loginResultSchema,
  providerDescriptorSchema,
  type ProviderDescriptor,
  type Role,
  roleSchema,
  sessionUserSchema,
  type SessionUser,
} from './schemas'

export async function login(input: LoginRequest): Promise<LoginResult> {
  const result = await api.POST('/auth/login/password', { body: input })
  if (!result.data) {
    throw apiError('Login failed', result.response.status)
  }
  // single-role logins keep the plain SessionUser shape; multi-role humans
  // get requires_role_selection + available_roles (REQ-NON-3)
  return loginResultSchema.parse(result.data)
}

export async function selectSessionRole(role: Role): Promise<SessionUser> {
  // the wire type excludes 'external' (legacy client-side value)
  const result = await api.POST('/auth/session/role', {
    body: { role: role as 'admin' | 'caregiver' },
  })
  if (!result.data) {
    throw apiError('Role selection failed', result.response.status)
  }
  return sessionUserSchema.parse(result.data)
}

export async function fetchSessionRoles(): Promise<Role[]> {
  const result = await api.GET('/auth/session/roles', {})
  if (!result.data) {
    throw apiError('Session roles fetch failed', result.response.status)
  }
  return result.data.map((entry) => roleSchema.parse(entry))
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
