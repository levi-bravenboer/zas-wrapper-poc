import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { getPathwayVersion, listBlockTypes } from '@/modules/pathway/api'

import {
  cancelEnrollment,
  completeStep,
  createEnrollment,
  fastForwardEnrollment,
  listPatientEnrollments,
  patchDeferredValue,
  pauseEnrollment,
  resumeEnrollment,
} from './api'
import { patientPathwayKeys } from './keys'
import { deriveSummary } from './summary'
import type { BlockExecution, Enrollment, EnrollmentCreate, EnrollmentState } from './types'

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

export interface EnrollmentGlance {
  /** Pathway name (version label), null when the version carries none. */
  label: string | null
  phaseName: string | null
  done: number
  total: number
  state: EnrollmentState
}

/** Compact view-model of a patient's active (or paused) pathway for at-a-glance
 *  surfaces: pathway name + current phase + done/total. Returns null when the
 *  patient has no active enrollment (or while loading). */
export function useActiveEnrollmentGlance(patientId: string | null): EnrollmentGlance | null {
  const [now] = useState(() => Date.now())
  const enrollments = usePatientEnrollments(patientId)
  const active =
    (enrollments.data ?? []).find((e) => e.state === 'active' || e.state === 'paused') ?? null

  const versionQuery = useQuery({
    queryKey: ['pathway-version', active?.pathway_id, active?.pathway_version_id] as const,
    queryFn: () => getPathwayVersion(active!.pathway_id, active!.pathway_version_id),
    enabled: !!active,
    staleTime: 5 * 60_000,
  })
  const blockTypesQuery = useQuery({
    queryKey: ['block-types'],
    queryFn: listBlockTypes,
    enabled: !!active,
    staleTime: Number.POSITIVE_INFINITY,
  })

  if (!active || !versionQuery.data || !blockTypesQuery.data) return null

  const summary = deriveSummary({
    executions: active.executions ?? [],
    blocks: versionQuery.data.blocks ?? [],
    phases: versionQuery.data.phases ?? [],
    blockTypes: blockTypesQuery.data,
    now,
  })
  return {
    label: versionQuery.data.label ?? null,
    phaseName: summary.phaseName,
    done: summary.done,
    total: summary.total,
    state: active.state,
  }
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

export function useFastForwardEnrollment(patientId: string) {
  const qc = useQueryClient()
  return useMutation<Enrollment, Error, string>({
    mutationFn: (enrollmentId) => fastForwardEnrollment(enrollmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientPathwayKeys.enrollments(patientId) }),
  })
}

export interface PatchValueVariables {
  enrollmentId: string
  attr: string
  blockTemplateId: string
  valueJson: unknown
}

export function usePatchDeferredValue(patientId: string) {
  const qc = useQueryClient()
  return useMutation<void, Error, PatchValueVariables>({
    mutationFn: ({ enrollmentId, attr, blockTemplateId, valueJson }) =>
      patchDeferredValue(enrollmentId, attr, blockTemplateId, valueJson),
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
