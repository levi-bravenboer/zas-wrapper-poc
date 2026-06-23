import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { PractitionerRoleRead } from '@/modules/practitioner-role/schemas'

import {
  createOrganisation,
  deleteOrganisation,
  fetchAffiliatedPractitionerRoles,
  fetchMyOrganisations,
  fetchOrganisations,
  patchOrganisationTree,
  updateOrganisation,
} from './api'
import { organisationKeys } from './keys'
import type {
  OrganisationCreatePayload,
  OrganisationRead,
  OrganisationTreeUpdatePayload,
  OrganisationUpdatePayload,
} from './schemas'

const ORGANISATION_STALE_MS = 30_000

export function useAffiliatedPractitionerRoles(organisationId: string | null) {
  return useQuery<PractitionerRoleRead[]>({
    queryKey: organisationKeys.affiliatedPractitionerRoles(organisationId ?? ''),
    queryFn: () => {
      if (!organisationId) return Promise.resolve([])
      return fetchAffiliatedPractitionerRoles(organisationId)
    },
    enabled: !!organisationId,
    staleTime: ORGANISATION_STALE_MS,
  })
}

export function useOrganisations(options?: { enabled?: boolean }) {
  return useQuery<OrganisationRead[]>({
    queryKey: organisationKeys.list(),
    queryFn: fetchOrganisations,
    staleTime: ORGANISATION_STALE_MS,
    enabled: options?.enabled ?? true,
  })
}

export function useMyOrganisations(options?: { enabled?: boolean }) {
  return useQuery<OrganisationRead[]>({
    queryKey: organisationKeys.myList(),
    queryFn: fetchMyOrganisations,
    staleTime: ORGANISATION_STALE_MS,
    enabled: options?.enabled ?? true,
  })
}

export function useCreateOrganisation() {
  const qc = useQueryClient()
  return useMutation<OrganisationRead, Error, OrganisationCreatePayload>({
    mutationFn: createOrganisation,
    onSuccess: () => qc.invalidateQueries({ queryKey: organisationKeys.list() }),
  })
}

export interface UpdateOrganisationVariables {
  organisationId: string
  payload: OrganisationUpdatePayload
}

export function useUpdateOrganisation() {
  const qc = useQueryClient()
  return useMutation<OrganisationRead, Error, UpdateOrganisationVariables>({
    mutationFn: ({ organisationId, payload }) => updateOrganisation(organisationId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: organisationKeys.list() }),
  })
}

export function useOrganisationTreeMutation() {
  const qc = useQueryClient()
  return useMutation<OrganisationRead[], Error, OrganisationTreeUpdatePayload>({
    mutationFn: patchOrganisationTree,
    onSuccess: (items) => {
      // Re-seed the list cache with the server's fresh tree, then invalidate
      // dependent queries (affiliations + detail) so they refetch.
      qc.setQueryData(organisationKeys.list(), items)
      qc.invalidateQueries({ queryKey: organisationKeys.all })
    },
  })
}

export function useDeleteOrganisation() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: deleteOrganisation,
    onSuccess: () => qc.invalidateQueries({ queryKey: organisationKeys.list() }),
  })
}
