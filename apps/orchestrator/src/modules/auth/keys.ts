import { createQueryKeys } from '@/lib/query/keys'

export const authKeys = createQueryKeys('auth', (scope) => ({
  me: () => [scope, 'me'] as const,
  providers: () => [scope, 'providers'] as const,
}))
