import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { fetchPatient, fetchPatientCareTeams, patientsListKeyPrefix, updatePatient } from './api'
import { patientKeys } from './keys'
import type { CareTeamRow, PatientRow, PatientUpdatePayload } from './types'

const PATIENT_STALE_MS = 30_000

export function usePatient(patientId: string | null) {
  return useQuery<PatientRow>({
    queryKey: patientKeys.detail(patientId ?? ''),
    queryFn: () => {
      if (!patientId) return Promise.reject(new Error('patientId required'))
      return fetchPatient(patientId)
    },
    enabled: !!patientId,
    staleTime: PATIENT_STALE_MS,
  })
}

export function usePatientCareTeams(patientId: string | null) {
  return useQuery<CareTeamRow[]>({
    queryKey: patientKeys.careTeams(patientId ?? ''),
    queryFn: () => {
      if (!patientId) return Promise.resolve([])
      return fetchPatientCareTeams(patientId)
    },
    enabled: !!patientId,
    staleTime: PATIENT_STALE_MS,
  })
}

async function invalidatePatientCaches(qc: QueryClient, patientId: string): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: patientsListKeyPrefix }),
    qc.invalidateQueries({ queryKey: patientKeys.detail(patientId) }),
  ])
}

export interface UpdatePatientVariables {
  patientId: string
  payload: PatientUpdatePayload
}

export function useUpdatePatient() {
  const qc = useQueryClient()
  return useMutation<PatientRow, Error, UpdatePatientVariables>({
    mutationFn: ({ patientId, payload }) => updatePatient(patientId, payload),
    onSuccess: (_row, { patientId }) => invalidatePatientCaches(qc, patientId),
  })
}
