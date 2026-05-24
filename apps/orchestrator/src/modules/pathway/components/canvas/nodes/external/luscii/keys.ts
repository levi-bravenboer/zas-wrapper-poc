import { LUSCII_PROVIDER } from './types'

// Three-way naming alignment: backend table prefix = realtime channel = TanStack
// key prefix. Keeps cache invalidation free when the backend bumps a program.
export const lusciiKeys = {
  all: [LUSCII_PROVIDER] as const,
  programs: () => [LUSCII_PROVIDER, 'programs'] as const,
  program: (id: string) => [LUSCII_PROVIDER, 'programs', id] as const,
}
