import { api } from '@/lib/api/client'
import { apiError, readErrorBody } from '@/lib/api/errors'

import {
  practitionerRoleReadSchema,
  type PractitionerRoleCreatePayload,
  type PractitionerRoleRead,
  type PractitionerRoleUpdatePayload,
} from './schemas'

export async function openPractitionerRole(
  payload: PractitionerRoleCreatePayload,
): Promise<PractitionerRoleRead> {
  const { data, response } = await api.POST('/practitioner-roles', { body: payload })
  if (!response.ok || !data) {
    const body = await readErrorBody(response)
    throw apiError(
      body?.message ?? 'Practitioner role open failed',
      response.status,
      body?.code,
      body?.details,
    )
  }
  return practitionerRoleReadSchema.parse(data)
}

export async function updatePractitionerRole(
  roleId: string,
  payload: PractitionerRoleUpdatePayload,
): Promise<PractitionerRoleRead> {
  const { data, response } = await api.PATCH('/practitioner-roles/{role_id}', {
    params: { path: { role_id: roleId } },
    body: payload,
  })
  if (!response.ok || !data) {
    const body = await readErrorBody(response)
    throw apiError(
      body?.message ?? 'Practitioner role update failed',
      response.status,
      body?.code,
      body?.details,
    )
  }
  return practitionerRoleReadSchema.parse(data)
}

export async function closePractitionerRole(roleId: string): Promise<PractitionerRoleRead> {
  const { data, response } = await api.DELETE('/practitioner-roles/{role_id}', {
    params: { path: { role_id: roleId } },
  })
  if (!response.ok || !data) {
    const body = await readErrorBody(response)
    throw apiError(
      body?.message ?? 'Practitioner role close failed',
      response.status,
      body?.code,
      body?.details,
    )
  }
  return practitionerRoleReadSchema.parse(data)
}
