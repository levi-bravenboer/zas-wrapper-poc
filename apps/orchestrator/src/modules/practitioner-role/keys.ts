export const PRACTITIONER_ROLE_KEYS_SCOPE = 'practitioner-roles' as const

export const practitionerRoleKeys = {
  all: [PRACTITIONER_ROLE_KEYS_SCOPE] as const,
  detail: (roleId: string) => [PRACTITIONER_ROLE_KEYS_SCOPE, 'detail', roleId] as const,
}

export const PRACTITIONER_ROLES_LIST_PATH = '/practitioner-roles'
