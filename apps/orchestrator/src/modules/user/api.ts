import { api } from '@/lib/api/client'
import { apiError } from '@/lib/api/errors'

import {
  assignRoleRequestSchema,
  setActiveRequestSchema,
  userDetailSchema,
  userRowSchema,
  type AssignRoleRequest,
  type Role,
  type SetActiveRequest,
  type UserDetail,
  type UserRow,
} from './schemas'

export async function fetchUserDetail(userId: string): Promise<UserDetail> {
  const { data, response } = await api.GET('/users/{user_id}', {
    params: { path: { user_id: userId } },
  })
  if (!response.ok || !data) {
    throw apiError('User fetch failed', response.status)
  }
  return userDetailSchema.parse(data)
}

export async function setUserActive(userId: string, payload: SetActiveRequest): Promise<UserRow> {
  const body = setActiveRequestSchema.parse(payload)
  const { data, response } = await api.PATCH('/users/{user_id}/active', {
    params: { path: { user_id: userId } },
    body,
  })
  if (!response.ok || !data) {
    throw apiError('Set active failed', response.status)
  }
  return userRowSchema.parse(data)
}

export async function assignUserRole(userId: string, payload: AssignRoleRequest): Promise<UserRow> {
  const body = assignRoleRequestSchema.parse(payload)
  const { data, response } = await api.PATCH('/users/{user_id}/role', {
    params: { path: { user_id: userId } },
    body,
  })
  if (!response.ok || !data) {
    throw apiError('Assign role failed', response.status)
  }
  return userRowSchema.parse(data)
}

export type { AssignRoleRequest, Role, SetActiveRequest, UserDetail, UserRow }
