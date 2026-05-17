import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createOrganisation,
  deleteOrganisation,
  fetchAffiliatedPractitionerRoles,
  fetchOrganisations,
  updateOrganisation,
  type PractitionerRoleRead,
} from './api'
import { organisationKeys } from './keys'
import type {
  OrganisationCreatePayload,
  OrganisationRead,
  OrganisationUpdatePayload,
} from './schemas'

export function useAffiliatedPractitionerRoles(organisationId: string | null) {
  return useQuery<PractitionerRoleRead[]>({
    queryKey: organisationKeys.affiliatedPractitionerRoles(organisationId ?? ''),
    queryFn: () => fetchAffiliatedPractitionerRoles(organisationId as string),
    enabled: !!organisationId,
    staleTime: 30_000,
  })
}

export function useOrganisations() {
  return useQuery<OrganisationRead[]>({
    queryKey: organisationKeys.list(),
    queryFn: fetchOrganisations,
    staleTime: 30_000,
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

export function useDeleteOrganisation() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: deleteOrganisation,
    onSuccess: () => qc.invalidateQueries({ queryKey: organisationKeys.list() }),
  })
}
