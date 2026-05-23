const ORGANISATION_KEYS_SCOPE = 'organisations' as const

export const organisationKeys = {
  all: [ORGANISATION_KEYS_SCOPE] as const,
  list: () => [ORGANISATION_KEYS_SCOPE, 'list'] as const,
  tree: () => [ORGANISATION_KEYS_SCOPE, 'list'] as const,
  detail: (organisationId: string) => [ORGANISATION_KEYS_SCOPE, 'detail', organisationId] as const,
  affiliatedPractitionerRoles: (organisationId: string) =>
    [ORGANISATION_KEYS_SCOPE, 'practitioner-roles', organisationId] as const,
}
