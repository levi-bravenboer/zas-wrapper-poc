import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import { apiError, readErrorCode } from '@/lib/api/errors'
import type { components } from '@/lib/api/schema'

export type Role = components['schemas']['RoleRead']
export type RoleCreatePayload = components['schemas']['RoleCreate']
export type RoleUpdatePayload = components['schemas']['RoleUpdate']

/** Stable empty fallback so `useRoles().data ?? EMPTY_ROLES` keeps a constant
 *  reference across renders (avoids useMemo/effect dep churn). */
export const EMPTY_ROLES: Role[] = []

export const rolesKey = ['roles'] as const
export const roleKey = (id: string) => ['roles', id] as const
export const permissionsKey = ['permissions'] as const

export async function fetchRoles(): Promise<Role[]> {
  const { data, response } = await api.GET('/roles', {})
  if (!response.ok || !data) throw apiError('Roles fetch failed', response.status)
  return data
}

export async function fetchRole(id: string): Promise<Role> {
  const { data, response } = await api.GET('/roles/{role_id}', {
    params: { path: { role_id: id } },
  })
  if (!response.ok || !data) throw apiError('Role fetch failed', response.status)
  return data
}

export async function fetchPermissions(): Promise<string[]> {
  const { data, response } = await api.GET('/permissions', {})
  if (!response.ok || !data) throw apiError('Permissions fetch failed', response.status)
  return data
}

export async function createRole(payload: RoleCreatePayload): Promise<Role> {
  const { data, response } = await api.POST('/roles', { body: payload })
  if (!response.ok || !data) {
    throw apiError('Role create failed', response.status, await readErrorCode(response))
  }
  return data
}

export async function updateRole(id: string, payload: RoleUpdatePayload): Promise<Role> {
  const { data, response } = await api.PATCH('/roles/{role_id}', {
    params: { path: { role_id: id } },
    body: payload,
  })
  if (!response.ok || !data) {
    throw apiError('Role update failed', response.status, await readErrorCode(response))
  }
  return data
}

export async function deleteRole(id: string): Promise<void> {
  const { response } = await api.DELETE('/roles/{role_id}', { params: { path: { role_id: id } } })
  if (!response.ok)
    throw apiError('Role delete failed', response.status, await readErrorCode(response))
}

export function useRoles(): UseQueryResult<Role[], Error> {
  return useQuery({ queryKey: rolesKey, queryFn: fetchRoles, staleTime: 5 * 60_000 })
}

export function useRole(id: string): UseQueryResult<Role, Error> {
  return useQuery({ queryKey: roleKey(id), queryFn: () => fetchRole(id), enabled: !!id })
}

export function usePermissions(): UseQueryResult<string[], Error> {
  return useQuery({ queryKey: permissionsKey, queryFn: fetchPermissions, staleTime: 30 * 60_000 })
}

/** id → role, for resolving a user's `role_id` to a display name/slug. */
export function useRoleMap(): Map<string, Role> {
  const { data } = useRoles()
  return new Map((data ?? []).map((r) => [r.id, r]))
}

function useInvalidateRoles() {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: rolesKey })
}

export function useCreateRole(): UseMutationResult<Role, Error, RoleCreatePayload> {
  const invalidate = useInvalidateRoles()
  return useMutation({ mutationFn: createRole, onSuccess: invalidate })
}

export function useUpdateRole(id: string): UseMutationResult<Role, Error, RoleUpdatePayload> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: RoleUpdatePayload) => updateRole(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rolesKey })
      void qc.invalidateQueries({ queryKey: roleKey(id) })
    },
  })
}

export function useDeleteRole(): UseMutationResult<void, Error, string> {
  const invalidate = useInvalidateRoles()
  return useMutation({ mutationFn: deleteRole, onSuccess: invalidate })
}
