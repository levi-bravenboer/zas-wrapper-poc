import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { router } from '@/app/router'

import {
  fetchProviders,
  fetchSession,
  fetchSessionRoles,
  login,
  logout,
  selectSessionRole,
} from './api'
import { authKeys } from './keys'
import type {
  LoginRequest,
  LoginResult,
  ProviderDescriptor,
  RoleOption,
  SessionUser,
} from './schemas'

export function useSession() {
  return useQuery<SessionUser | null>({
    queryKey: authKeys.me(),
    queryFn: fetchSession,
    staleTime: 60_000,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation<LoginResult, Error, LoginRequest>({
    mutationFn: login,
    onSuccess: (result) => {
      // multi-role logins are live but unbound — the session cache only
      // gets a user once a role is picked (useSelectRole)
      if (!('requires_role_selection' in result)) {
        qc.setQueryData(authKeys.me(), result)
      }
    },
  })
}

export function useSelectRole() {
  const qc = useQueryClient()
  return useMutation<SessionUser, Error, string>({
    mutationFn: selectSessionRole,
    onSuccess: (user) => {
      qc.setQueryData(authKeys.me(), user)
      // role switch changes every authz answer — refetch the world
      void qc.invalidateQueries()
    },
  })
}

export function useSessionRoles() {
  return useQuery<RoleOption[]>({
    queryKey: authKeys.sessionRoles(),
    queryFn: fetchSessionRoles,
    staleTime: 60_000,
  })
}

export function useProviders() {
  return useQuery<ProviderDescriptor[]>({
    queryKey: authKeys.providers(),
    queryFn: fetchProviders,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation<void, Error, void>({
    mutationFn: logout,
    onSuccess: () => {
      qc.clear()
      void router.navigate({ to: '/login', replace: true })
    },
  })
}
