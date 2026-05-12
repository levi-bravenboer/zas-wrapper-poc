import type { QueryClient } from '@tanstack/react-query'

import { fetchSession } from './api'
import { authKeys } from './keys'
import type { SessionUser } from './schemas'

export const SESSION_STALE_TIME = 60_000

export function requireSession(queryClient: QueryClient): Promise<SessionUser | null> {
  return queryClient.ensureQueryData<SessionUser | null>({
    queryKey: authKeys.me(),
    queryFn: fetchSession,
    staleTime: SESSION_STALE_TIME,
  })
}
