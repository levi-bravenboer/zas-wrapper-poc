import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchSession, login, logout } from './api'
import { authKeys } from './keys'
import type { LoginRequest, SessionUser } from './schemas'

export function useSession() {
  return useQuery<SessionUser | null>({
    queryKey: authKeys.me(),
    queryFn: fetchSession,
    staleTime: 60_000,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation<SessionUser, Error, LoginRequest>({
    mutationFn: login,
    onSuccess: (user) => {
      qc.setQueryData(authKeys.me(), user)
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation<void, Error, void>({
    mutationFn: logout,
    onSuccess: () => {
      qc.setQueryData(authKeys.me(), null)
      qc.invalidateQueries({ queryKey: authKeys.all })
    },
  })
}
