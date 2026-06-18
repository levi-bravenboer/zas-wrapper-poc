import { api } from '@/lib/api/client'
import { apiError, readErrorCode } from '@/lib/api/errors'

import {
  assignRoleRequestSchema,
  setActiveRequestSchema,
  userDetailSchema,
  userRowSchema,
  type AssignRoleRequest,
  type SetActiveRequest,
  type UserCreatePayload,
  type UserDetail,
  type UserRow,
  type UserUpdatePayload,
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

export async function createUser(payload: UserCreatePayload): Promise<UserRow> {
  const { data, response } = await api.POST('/users', { body: payload })
  if (!response.ok || !data) {
    const code = await readErrorCode(response)
    throw apiError('User create failed', response.status, code)
  }
  return userRowSchema.parse(data)
}

export async function updateUserDemographics(
  userId: string,
  payload: UserUpdatePayload,
): Promise<UserRow> {
  const { data, response } = await api.PATCH('/users/{user_id}', {
    params: { path: { user_id: userId } },
    body: payload,
  })
  if (!response.ok || !data) {
    const code = await readErrorCode(response)
    throw apiError('User update failed', response.status, code)
  }
  return userRowSchema.parse(data)
}

export type {
  AssignRoleRequest,
  SetActiveRequest,
  UserCreatePayload,
  UserDetail,
  UserRow,
  UserUpdatePayload,
}
