import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createEnrollment, listPatientEnrollments } from './api'
import { patientPathwayKeys } from './keys'
import type { Enrollment, EnrollmentCreate } from './types'

const ENROLLMENTS_STALE_MS = 30_000

export function usePatientEnrollments(patientId: string | null) {
  return useQuery<Enrollment[]>({
    queryKey: patientPathwayKeys.enrollments(patientId ?? ''),
    queryFn: () => {
      if (!patientId) return Promise.resolve([])
      return listPatientEnrollments(patientId)
    },
    enabled: !!patientId,
    staleTime: ENROLLMENTS_STALE_MS,
  })
}

export function useCreateEnrollment(patientId: string) {
  const qc = useQueryClient()
  return useMutation<Enrollment, Error, EnrollmentCreate>({
    mutationFn: (payload) => createEnrollment(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientPathwayKeys.enrollments(patientId) }),
  })
}
