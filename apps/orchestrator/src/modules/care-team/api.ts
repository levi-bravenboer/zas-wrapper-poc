import { api } from '@/lib/api/client'
import { apiError, readErrorBody } from '@/lib/api/errors'

import type {
  CareTeamCreatePayload,
  CareTeamRow,
  CareTeamUpdatePayload,
  ParticipantCreatePayload,
  ParticipantRoleChangePayload,
  ParticipantRow,
} from './types'

export async function createCareTeam(
  patientId: string,
  payload: CareTeamCreatePayload,
): Promise<CareTeamRow> {
  const { data, response } = await api.POST('/patients/{patient_id}/care-teams', {
    params: { path: { patient_id: patientId } },
    body: payload,
  })
  if (!response.ok || !data) {
    const body = await readErrorBody(response)
    throw apiError(body?.message ?? 'Care team create failed', response.status, body?.code)
  }
  return data
}

export async function updateCareTeam(
  careTeamId: string,
  payload: CareTeamUpdatePayload,
): Promise<CareTeamRow> {
  const { data, response } = await api.PATCH('/care-teams/{care_team_id}', {
    params: { path: { care_team_id: careTeamId } },
    body: payload,
  })
  if (!response.ok || !data) {
    const body = await readErrorBody(response)
    throw apiError(body?.message ?? 'Care team update failed', response.status, body?.code)
  }
  return data
}

export async function addParticipant(
  careTeamId: string,
  payload: ParticipantCreatePayload,
): Promise<ParticipantRow> {
  const { data, response } = await api.POST('/care-teams/{care_team_id}/participants', {
    params: { path: { care_team_id: careTeamId } },
    body: payload,
  })
  if (!response.ok || !data) {
    const body = await readErrorBody(response)
    throw apiError(body?.message ?? 'Add participant failed', response.status, body?.code)
  }
  return data
}

export async function changeParticipantRole(
  careTeamId: string,
  userId: string,
  payload: ParticipantRoleChangePayload,
): Promise<ParticipantRow> {
  const { data, response } = await api.PATCH('/care-teams/{care_team_id}/participants/{user_id}', {
    params: { path: { care_team_id: careTeamId, user_id: userId } },
    body: payload,
  })
  if (!response.ok || !data) {
    const body = await readErrorBody(response)
    throw apiError(body?.message ?? 'Change role failed', response.status, body?.code)
  }
  return data
}

export async function unassignParticipant(careTeamId: string, userId: string): Promise<void> {
  const { response } = await api.DELETE('/care-teams/{care_team_id}/participants/{user_id}', {
    params: { path: { care_team_id: careTeamId, user_id: userId } },
  })
  if (!response.ok) {
    const body = await readErrorBody(response)
    throw apiError(body?.message ?? 'Unassign failed', response.status, body?.code)
  }
}
