import { queryOptions } from '@tanstack/react-query'

import { UnauthenticatedError } from '@/lib/api'

import { me } from './api'

export const authQueries = {
  all: () => ['auth'] as const,
  me: () =>
    queryOptions({
      queryKey: [...authQueries.all(), 'me'],
      queryFn: me,
      retry: (_count, err) => !(err instanceof UnauthenticatedError),
    }),
}
