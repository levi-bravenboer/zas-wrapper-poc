import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { closePractitionerRole, openPractitionerRole, updatePractitionerRole } from './api'
import { PRACTITIONER_ROLES_LIST_PATH } from './keys'
import type {
  PractitionerRoleCreatePayload,
  PractitionerRoleRead,
  PractitionerRoleUpdatePayload,
} from './schemas'

async function invalidatePractitionerRoleCaches(qc: QueryClient): Promise<void> {
  await qc.invalidateQueries({ queryKey: ['paginated', PRACTITIONER_ROLES_LIST_PATH] })
}

export function useOpenPractitionerRole() {
  const qc = useQueryClient()
  return useMutation<PractitionerRoleRead, Error, PractitionerRoleCreatePayload>({
    mutationFn: (payload) => openPractitionerRole(payload),
    onSuccess: () => invalidatePractitionerRoleCaches(qc),
  })
}

export interface UpdatePractitionerRoleVariables {
  roleId: string
  payload: PractitionerRoleUpdatePayload
}

export function useUpdatePractitionerRole() {
  const qc = useQueryClient()
  return useMutation<PractitionerRoleRead, Error, UpdatePractitionerRoleVariables>({
    mutationFn: ({ roleId, payload }) => updatePractitionerRole(roleId, payload),
    onSuccess: () => invalidatePractitionerRoleCaches(qc),
  })
}

export function useClosePractitionerRole() {
  const qc = useQueryClient()
  return useMutation<PractitionerRoleRead, Error, string>({
    mutationFn: (roleId) => closePractitionerRole(roleId),
    onSuccess: () => invalidatePractitionerRoleCaches(qc),
  })
}
