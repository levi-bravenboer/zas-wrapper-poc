const USER_KEYS_SCOPE = 'users' as const

export const userKeys = {
  all: [USER_KEYS_SCOPE] as const,
  detail: (userId: string) => [USER_KEYS_SCOPE, 'detail', userId] as const,
}

export const practitionerKeys = {
  detail: (userId: string) => ['practitioner', userId] as const,
}

export const USERS_LIST_PATH = '/users'
