import { useQuery } from '@tanstack/react-query'

import { authQueries } from '@/modules/auth/queries'

export function useSession() {
  const { data, isLoading, error } = useQuery(authQueries.me())

  return {
    session: data ?? undefined,
    isAuthenticated: !!data,
    isLoading,
    error,
  }
}
