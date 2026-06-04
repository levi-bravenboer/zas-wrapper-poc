import { queryClient } from '@/lib/query-client'

import { login } from './api'
import { authQueries } from './queries'
import type { LoginInput } from './types'

export const authMutations = {
  login: () => ({
    mutationFn: async (input: LoginInput) => login(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueries.all() })
    },
  }),
}
