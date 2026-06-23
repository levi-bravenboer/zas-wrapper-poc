import { api } from '@/lib/api/client'
import { apiError, readErrorBody } from '@/lib/api/errors'
import { serializeListQuery } from '@/lib/query/paginated'
import type { PractitionerRoleRead } from '@/modules/practitioner-role/schemas'

import {
  organisationListSchema,
  organisationReadSchema,
  type OrganisationCreatePayload,
  type OrganisationRead,
  type OrganisationTreeUpdatePayload,
  type OrganisationUpdatePayload,
} from './schemas'

export async function fetchOrganisations(): Promise<OrganisationRead[]> {
  const { data, response } = await api.GET('/organisations', {})
  if (!response.ok || !data) {
    throw apiError('Organisation list failed', response.status)
  }
  return organisationListSchema.parse(data).items
}

export async function fetchMyOrganisations(): Promise<OrganisationRead[]> {
  const { data, response } = await api.GET('/me/organisations', {})
  if (!response.ok || !data) {
    throw apiError('Own organisation list failed', response.status)
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
  // List endpoint returns `Page<PractitionerRoleRead>` and filters via the
  // bracket-key envelope. PoC scale: bump `page_size` so the sheet sees the
  // full open set in one shot, no virtualisation.
  const client = api as unknown as {
    GET: (
      p: string,
      init: {
        params: { query: Parameters<typeof serializeListQuery>[0] }
        querySerializer?: typeof serializeListQuery
      },
    ) => Promise<{ data?: { items: PractitionerRoleRead[] }; response: Response }>
  }
  const { data, response } = await client.GET('/practitioner-roles', {
    params: {
      query: {
        page: 1,
        page_size: 200,
        filters: {
          organisation_id: { op: 'eq', value: organisationId },
          is_open: { op: 'eq', value: true },
        },
      },
    },
    querySerializer: serializeListQuery,
  })
  if (!response.ok || !data) {
    throw apiError('Affiliated practitioner roles failed', response.status)
  }
  return data.items
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
