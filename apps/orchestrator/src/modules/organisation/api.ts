import { api } from '@/lib/api/client'
import { apiError, readErrorBody } from '@/lib/api/errors'
import type { components } from '@/lib/api/schema'

import {
  organisationListSchema,
  organisationReadSchema,
  type OrganisationCreatePayload,
  type OrganisationRead,
  type OrganisationTreeUpdatePayload,
  type OrganisationUpdatePayload,
} from './schemas'

export type PractitionerRoleRead = components['schemas']['PractitionerRoleRead']

export async function fetchOrganisations(): Promise<OrganisationRead[]> {
  const { data, response } = await api.GET('/organisations', {})
  if (!response.ok || !data) {
    throw apiError('Organisation list failed', response.status)
  }
  return organisationListSchema.parse(data).items
}

export async function createOrganisation(
  payload: OrganisationCreatePayload,
): Promise<OrganisationRead> {
  const { data, response } = await api.POST('/organisations', { body: payload })
  if (!response.ok || !data) {
    const body = await readErrorBody(response)
    throw apiError(
      body?.message ?? 'Organisation create failed',
      response.status,
      body?.code,
      body?.details,
    )
  }
  return organisationReadSchema.parse(data)
}

export async function updateOrganisation(
  organisationId: string,
  payload: OrganisationUpdatePayload,
): Promise<OrganisationRead> {
  const { data, response } = await api.PATCH('/organisations/{organisation_id}', {
    params: { path: { organisation_id: organisationId } },
    body: payload,
  })
  if (!response.ok || !data) {
    const body = await readErrorBody(response)
    throw apiError(
      body?.message ?? 'Organisation update failed',
      response.status,
      body?.code,
      body?.details,
    )
  }
  return organisationReadSchema.parse(data)
}

export async function fetchAffiliatedPractitionerRoles(
  organisationId: string,
): Promise<PractitionerRoleRead[]> {
  const { data, response } = await api.GET('/practitioner-roles', {
    params: { query: { organisation_id: organisationId, is_open: true } },
  })
  if (!response.ok || !data) {
    throw apiError('Affiliated practitioner roles failed', response.status)
  }
  return data
}

export async function patchOrganisationTree(
  payload: OrganisationTreeUpdatePayload,
): Promise<OrganisationRead[]> {
  const { data, response } = await api.PATCH('/admin/organisations/tree', { body: payload })
  if (!response.ok || !data) {
    const body = await readErrorBody(response)
    throw apiError(
      body?.message ?? 'Organisation tree update failed',
      response.status,
      body?.code,
      body?.details,
    )
  }
  return organisationListSchema.parse(data).items
}

export async function deleteOrganisation(organisationId: string): Promise<void> {
  const { response } = await api.DELETE('/organisations/{organisation_id}', {
    params: { path: { organisation_id: organisationId } },
  })
  if (!response.ok) {
    const body = await readErrorBody(response)
    throw apiError(
      body?.message ?? 'Organisation delete failed',
      response.status,
      body?.code,
      body?.details,
    )
  }
}
