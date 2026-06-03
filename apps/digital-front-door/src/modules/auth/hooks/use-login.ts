import { useMutation } from '@tanstack/react-query'

import { authMutations } from '@/modules/auth/mutations'

export function useLogin() {
  const mutation = useMutation(authMutations.login())

  return {
    login: mutation.mutate,
    isLoading: mutation.isPending,
    error: mutation.error,
  }
}
