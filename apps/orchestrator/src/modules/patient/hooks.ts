import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import { getPathwayVersion } from '@/modules/pathway/api'
import { usePatientEnrollments } from '@/modules/patient-pathway/hooks'

import {
  addLusciiConnection,
  deactivateLusciiConnection,
  fetchLusciiConnections,
  fetchLusciiData,
  fetchPatient,
  fetchPatientCareTeams,
  linkLuscii,
  patientsListKeyPrefix,
  unlinkLuscii,
  updatePatient,
} from './api'
import { patientKeys } from './keys'
import type { EnrollmentCarepath } from './lusciiCarepathMatch'
import type {
  CareTeamRow,
  LusciiConnectionSummary,
  LusciiLinkResult,
  LusciiPatientData,
  PatientRow,
  PatientUpdatePayload,
} from './types'

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

export type LusciiWindowDays = 7 | 30 | 90 | 365

export interface UseLusciiDataOptions {
  days?: LusciiWindowDays
}

export function useLusciiData(patientId: string | null, options?: UseLusciiDataOptions) {
  const days = options?.days ?? 30
  return useQuery<LusciiPatientData>({
    queryKey: patientKeys.lusciiData(patientId ?? '', days),
    queryFn: () => {
      if (!patientId) return Promise.reject(new Error('patientId required'))
      return fetchLusciiData(patientId, { days })
    },
    enabled: !!patientId,
    staleTime: PATIENT_STALE_MS,
    // Live proxy against an external vendor: a failing Luscii must not be
    // hammered with automatic retries from every open patient view.
    retry: false,
  })
}

async function invalidateLusciiCaches(qc: QueryClient, patientId: string): Promise<void> {
  await Promise.all([
    // Prefix invalidation so every active window (7d/30d/90d/365d) refreshes.
    qc.invalidateQueries({ queryKey: patientKeys.lusciiDataPrefix(patientId) }),
    qc.invalidateQueries({ queryKey: patientKeys.lusciiConnections(patientId) }),
    qc.invalidateQueries({ queryKey: patientKeys.detail(patientId) }),
  ])
}

export function useLusciiConnections(patientId: string | null) {
  return useQuery<LusciiConnectionSummary[]>({
    queryKey: patientKeys.lusciiConnections(patientId ?? ''),
    queryFn: () => {
      if (!patientId) return Promise.resolve([])
      return fetchLusciiConnections(patientId)
    },
    enabled: !!patientId,
  })
}

export interface AddLusciiConnectionVariables {
  patientId: string
  lusciiPatientId: string
}

export function useAddLusciiConnection() {
  const qc = useQueryClient()
  return useMutation<LusciiConnectionSummary, Error, AddLusciiConnectionVariables>({
    mutationFn: ({ patientId, lusciiPatientId }) => addLusciiConnection(patientId, lusciiPatientId),
    onSuccess: (_result, { patientId }) => invalidateLusciiCaches(qc, patientId),
  })
}

export interface DeactivateLusciiConnectionVariables {
  patientId: string
  connectionId: string
}

export function useDeactivateLusciiConnection() {
  const qc = useQueryClient()
  return useMutation<void, Error, DeactivateLusciiConnectionVariables>({
    mutationFn: ({ patientId, connectionId }) =>
      deactivateLusciiConnection(patientId, connectionId),
    onSuccess: (_void, { patientId }) => invalidateLusciiCaches(qc, patientId),
  })
}

export interface LinkLusciiVariables {
  patientId: string
  lusciiPatientId: string
}

export function useLinkLuscii() {
  const qc = useQueryClient()
  return useMutation<LusciiLinkResult, Error, LinkLusciiVariables>({
    mutationFn: ({ patientId, lusciiPatientId }) => linkLuscii(patientId, lusciiPatientId),
    onSuccess: (_result, { patientId }) => invalidateLusciiCaches(qc, patientId),
  })
}

export function useUnlinkLuscii() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (patientId) => unlinkLuscii(patientId),
    onSuccess: (_void, patientId) => invalidateLusciiCaches(qc, patientId),
  })
}

// Resolves the patient's enrollments into `EnrollmentCarepath[]` for Luscii
// connection → carepath attribution (presentation only — reads existing
// enrollment + pathway-version APIs, never the pathway datalayer). One version
// fetch per enrollment, cached.
export function usePatientCarepaths(patientId: string | null): EnrollmentCarepath[] {
  const enrollments = usePatientEnrollments(patientId)
  const rows = enrollments.data ?? []
  const versions = useQueries({
    queries: rows.map((e) => ({
      queryKey: ['pathway-version', e.pathway_id, e.pathway_version_id],
      queryFn: () => getPathwayVersion(e.pathway_id, e.pathway_version_id),
      staleTime: 5 * 60_000,
    })),
  })
  return rows.map((enrollment, index) => {
    const blocks = versions[index]?.data?.blocks ?? []
    const programIds = blocks.flatMap((block) =>
      block.kind === 'external_program' && block.provider === 'luscii' && block.program_id
        ? [block.program_id]
        : [],
    )
    return {
      enrollmentId: enrollment.id,
      pathwayName: versions[index]?.data?.label ?? null,
      state: enrollment.state,
      programIds,
    }
  })
}
