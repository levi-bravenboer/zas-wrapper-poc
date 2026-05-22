export const AUTH_KEYS_SCOPE = 'auth' as const

export const authKeys = {
  all: [AUTH_KEYS_SCOPE] as const,
  me: () => [AUTH_KEYS_SCOPE, 'me'] as const,
  providers: () => [AUTH_KEYS_SCOPE, 'providers'] as const,
}
