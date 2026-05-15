import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import { api } from '@/lib/api/client'

export const PATIENTS_PATH = '/patients'

/**
 * Resource key prefix used by `usePaginatedQuery` (see
 * `src/lib/query/paginated.ts:paginatedQueryKey`). Mutations invalidate by
 * matching this prefix so every paginated/`filters` variant of the list is
 * refetched after a write.
 */
export const patientsListKeyPrefix = ['paginated', PATIENTS_PATH] as const

export async function softDeletePatient(patientId: string): Promise<void> {
  const { response, error } = await api.DELETE('/patients/{patient_id}', {
    params: { path: { patient_id: patientId } },
  })
  if (!response.ok) {
    throw new Error(
      `Failed to delete patient (${response.status} ${response.statusText})${
        error ? `: ${JSON.stringify(error)}` : ''
      }`,
    )
  }
}

export function useSoftDeletePatient(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: softDeletePatient,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientsListKeyPrefix })
    },
  })
}
