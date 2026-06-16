import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  cancelEnrollment,
  completeStep,
  createEnrollment,
  listPatientEnrollments,
  pauseEnrollment,
  resumeEnrollment,
} from './api'
import { patientPathwayKeys } from './keys'
import type { BlockExecution, Enrollment, EnrollmentCreate } from './types'

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

export interface CompleteStepVariables {
  enrollmentId: string
  execution: BlockExecution
  result?: Record<string, unknown> | null
}

export function useCancelEnrollment(patientId: string) {
  const qc = useQueryClient()
  return useMutation<Enrollment, Error, string>({
    mutationFn: (enrollmentId) => cancelEnrollment(enrollmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientPathwayKeys.enrollments(patientId) }),
  })
}

export function usePauseEnrollment(patientId: string) {
  const qc = useQueryClient()
  return useMutation<Enrollment, Error, string>({
    mutationFn: (enrollmentId) => pauseEnrollment(enrollmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientPathwayKeys.enrollments(patientId) }),
  })
}

export function useResumeEnrollment(patientId: string) {
  const qc = useQueryClient()
  return useMutation<Enrollment, Error, string>({
    mutationFn: (enrollmentId) => resumeEnrollment(enrollmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientPathwayKeys.enrollments(patientId) }),
  })
}

export function useCompleteStep(patientId: string) {
  const qc = useQueryClient()
  return useMutation<BlockExecution, Error, CompleteStepVariables>({
    mutationFn: ({ enrollmentId, execution, result }) =>
      completeStep(enrollmentId, execution, result ?? null),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientPathwayKeys.enrollments(patientId) }),
  })
}
