import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { patientKeys } from '@/modules/patient/keys'

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
