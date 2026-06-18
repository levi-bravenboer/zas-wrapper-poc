import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import { apiError } from '@/lib/api/errors'
import type { components } from '@/lib/api/schema'

export type Role = components['schemas']['RoleRead']

/** Stable empty fallback so `useRoles().data ?? EMPTY_ROLES` keeps a constant
 *  reference across renders (avoids useMemo/effect dep churn). */
export const EMPTY_ROLES: Role[] = []

export const rolesKey = ['roles'] as const

export async function fetchRoles(): Promise<Role[]> {
  const { data, response } = await api.GET('/roles', {})
  if (!response.ok || !data) {
    throw apiError('Roles fetch failed', response.status)
  }
  return data
}

export function useRoles(): UseQueryResult<Role[], Error> {
  return useQuery({ queryKey: rolesKey, queryFn: fetchRoles, staleTime: 5 * 60_000 })
}

/** id → role, for resolving a user's `role_id` to a display name/slug. */
export function useRoleMap(): Map<string, Role> {
  const { data } = useRoles()
  return new Map((data ?? []).map((r) => [r.id, r]))
}
