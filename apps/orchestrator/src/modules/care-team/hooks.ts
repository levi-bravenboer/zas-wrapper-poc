import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { usePatientCareTeams } from '@/modules/patient/hooks'
import { patientKeys } from '@/modules/patient/keys'
import { fetchUserDetail } from '@/modules/user/api'

import {
  addParticipant,
  changeParticipantRole,
  createCareTeam,
  unassignParticipant,
  updateCareTeam,
} from './api'
import type {
  CareTeamCreatePayload,
  CareTeamRow,
  CareTeamUpdatePayload,
  ParticipantCreatePayload,
  ParticipantRoleChangePayload,
  ParticipantRow,
} from './types'

export interface CareTeamLead {
  userId: string
  displayName: string
}

/** The patient's treating clinician — the `primary` participant on an active
 *  care team. Resolves the user's display name (single fetch; null on a missing
 *  lead, while loading, or when the name can't be resolved). */
export function useCareTeamLead(patientId: string | null): CareTeamLead | null {
  const teams = usePatientCareTeams(patientId)
  const active = (teams.data ?? []).find((tm) => !tm.period_end && tm.status === 'active')
  const lead =
    active?.participants.find((p) => p.role_in_care === 'primary' && !p.period_end) ?? null

  const userQuery = useQuery({
    queryKey: ['user-detail', lead?.user_id] as const,
    queryFn: () => fetchUserDetail(lead!.user_id),
    enabled: !!lead,
    retry: false,
    staleTime: 5 * 60_000,
  })

  if (!lead || !userQuery.data) return null
  return { userId: lead.user_id, displayName: userQuery.data.display_name }
}

function invalidateCareTeams(qc: QueryClient, patientId: string) {
  return qc.invalidateQueries({ queryKey: patientKeys.careTeams(patientId) })
}

export interface CreateCareTeamVariables {
  patientId: string
  payload: CareTeamCreatePayload
}

export function useCreateCareTeam() {
  const qc = useQueryClient()
  return useMutation<CareTeamRow, Error, CreateCareTeamVariables>({
    mutationFn: ({ patientId, payload }) => createCareTeam(patientId, payload),
    onSuccess: (_data, { patientId }) => invalidateCareTeams(qc, patientId),
  })
}

export interface UpdateCareTeamVariables {
  careTeamId: string
  patientId: string
  payload: CareTeamUpdatePayload
}

export function useUpdateCareTeam() {
  const qc = useQueryClient()
  return useMutation<CareTeamRow, Error, UpdateCareTeamVariables>({
    mutationFn: ({ careTeamId, payload }) => updateCareTeam(careTeamId, payload),
    onSuccess: (_data, { patientId }) => invalidateCareTeams(qc, patientId),
  })
}

export interface AddParticipantVariables {
  careTeamId: string
  patientId: string
  payload: ParticipantCreatePayload
}

export function useAddParticipant() {
  const qc = useQueryClient()
  return useMutation<ParticipantRow, Error, AddParticipantVariables>({
    mutationFn: ({ careTeamId, payload }) => addParticipant(careTeamId, payload),
    onSuccess: (_data, { patientId }) => invalidateCareTeams(qc, patientId),
  })
}

export interface ChangeParticipantRoleVariables {
  careTeamId: string
  userId: string
  patientId: string
  payload: ParticipantRoleChangePayload
}

export function useChangeParticipantRole() {
  const qc = useQueryClient()
  return useMutation<ParticipantRow, Error, ChangeParticipantRoleVariables>({
    mutationFn: ({ careTeamId, userId, payload }) =>
      changeParticipantRole(careTeamId, userId, payload),
    onSuccess: (_data, { patientId }) => invalidateCareTeams(qc, patientId),
  })
}

export interface UnassignParticipantVariables {
  careTeamId: string
  userId: string
  patientId: string
}

export function useUnassignParticipant() {
  const qc = useQueryClient()
  return useMutation<void, Error, UnassignParticipantVariables>({
    mutationFn: ({ careTeamId, userId }) => unassignParticipant(careTeamId, userId),
    onSuccess: (_data, { patientId }) => invalidateCareTeams(qc, patientId),
  })
}
