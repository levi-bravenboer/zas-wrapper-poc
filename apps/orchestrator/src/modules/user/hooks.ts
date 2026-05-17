import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { assignUserRole, fetchUserDetail, setUserActive } from './api'
import { USERS_LIST_PATH, userKeys } from './keys'
import type { Role, UserDetail, UserRow } from './schemas'

export function useUserDetail(userId: string) {
  return useQuery<UserDetail>({
    queryKey: userKeys.detail(userId),
    queryFn: () => fetchUserDetail(userId),
    enabled: !!userId,
    staleTime: 30_000,
  })
}

async function invalidateUserCaches(qc: QueryClient, userId: string): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ['paginated', USERS_LIST_PATH] }),
    qc.invalidateQueries({ queryKey: userKeys.detail(userId) }),
  ])
}

export interface SetActiveVariables {
  userId: string
  is_active: boolean
}

export function useSetUserActive() {
  const qc = useQueryClient()
  return useMutation<UserRow, Error, SetActiveVariables>({
    mutationFn: ({ userId, is_active }) => setUserActive(userId, { is_active }),
    onSuccess: (_row, { userId }) => invalidateUserCaches(qc, userId),
  })
}

export interface AssignRoleVariables {
  userId: string
  role: Role
}

export function useAssignUserRole() {
  const qc = useQueryClient()
  return useMutation<UserRow, Error, AssignRoleVariables>({
    mutationFn: ({ userId, role }) => assignUserRole(userId, { role }),
    onSuccess: (_row, { userId }) => invalidateUserCaches(qc, userId),
  })
}
