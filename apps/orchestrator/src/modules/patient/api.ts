import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import { apiError, readErrorBody } from '@/lib/api/errors'

import type {
  CareTeamRow,
  LusciiConnectionSummary,
  LusciiPatientData,
  PatientRow,
  PatientUpdatePayload,
} from './types'

export const PATIENTS_PATH = '/patients'

/**
 * Resource key prefix used by `usePaginatedQuery` (see
 * `src/lib/query/paginated.ts:paginatedQueryKey`). Mutations invalidate by
 * matching this prefix so every paginated/`filters` variant of the list is
 * refetched after a write.
 */
export const patientsListKeyPrefix = ['paginated', PATIENTS_PATH] as const

export async function fetchPatient(patientId: string): Promise<PatientRow> {
  const { data, response } = await api.GET('/patients/{patient_id}', {
    params: { path: { patient_id: patientId } },
  })
  if (!response.ok || !data) {
    throw apiError('Patient fetch failed', response.status)
  }
  return data
}

export async function updatePatient(
  patientId: string,
  payload: PatientUpdatePayload,
): Promise<PatientRow> {
  const { data, response } = await api.PATCH('/patients/{patient_id}', {
    params: { path: { patient_id: patientId } },
    body: payload,
  })
  if (!response.ok || !data) {
    throw apiError('Patient update failed', response.status)
  }
  return data
}

export async function fetchPatientCareTeams(patientId: string): Promise<CareTeamRow[]> {
  const { data, response } = await api.GET('/patients/{patient_id}/care-teams', {
    params: { path: { patient_id: patientId } },
  })
  if (!response.ok || !data) {
    throw apiError('Care teams fetch failed', response.status)
  }
  return data
}

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

async function lusciiError(message: string, response: Response): Promise<never> {
  const body = await readErrorBody(response)
  throw apiError(body?.message ?? message, response.status, body?.code, body?.details)
}

export async function fetchLusciiData(
  patientId: string,
  options?: { days?: number },
): Promise<LusciiPatientData> {
  const { data, response } = await api.GET('/patients/{patient_id}/luscii-data', {
    params: {
      path: { patient_id: patientId },
      query: options?.days ? { days: options.days } : {},
    },
  })
  if (!response.ok || !data) {
    return lusciiError('Luscii data fetch failed', response)
  }
  return data
}

export async function unlinkLuscii(patientId: string): Promise<void> {
  const { response } = await api.DELETE('/patients/{patient_id}/luscii-link', {
    params: { path: { patient_id: patientId } },
  })
  if (!response.ok) {
    return lusciiError('Luscii unlink failed', response)
  }
}

export async function fetchLusciiConnections(
  patientId: string,
): Promise<LusciiConnectionSummary[]> {
  const { data, response } = await api.GET('/patients/{patient_id}/luscii-connections', {
    params: { path: { patient_id: patientId } },
  })
  if (!response.ok || !data) {
    return lusciiError('Luscii connections fetch failed', response)
  }
  return data
}

export async function addLusciiConnection(
  patientId: string,
  lusciiPatientId: string,
): Promise<LusciiConnectionSummary> {
  const { data, response } = await api.POST('/patients/{patient_id}/luscii-connections', {
    params: { path: { patient_id: patientId } },
    body: { luscii_patient_id: lusciiPatientId },
  })
  if (!response.ok || !data) {
    return lusciiError('Luscii connection add failed', response)
  }
  return data
}

export async function deactivateLusciiConnection(
  patientId: string,
  connectionId: string,
): Promise<void> {
  const { response } = await api.DELETE(
    '/patients/{patient_id}/luscii-connections/{connection_id}',
    { params: { path: { patient_id: patientId, connection_id: connectionId } } },
  )
  if (!response.ok) {
    return lusciiError('Luscii connection deactivate failed', response)
  }
}
