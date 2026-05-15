import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import { paginatedQueryKey, type ListQuery } from '@/lib/query/paginated'

/**
 * Generic page envelope matching `apps/backend/app/schemas/_list/page.py`.
 *
 * NOTE: spec §11.3 wants this derived from the generated `schema.d.ts`
 * (`paths[P]["get"]["responses"]["200"]["content"]["application/json"]`).
 * No backend list endpoint currently emits `Page<T>` in the OpenAPI schema,
 * so the generated `paths` map does not yet contain any concrete `Page_T_`.
 * Once the first list route is added and the schema regenerates, swap this
 * local interface for the derived type via an overload that accepts a
 * `path: keyof paths`.
 */
export interface Page<T> {
  items: T[]
  page: number
  page_size: number
  total: number
  total_pages: number
}

/** Subset of `UseQueryOptions` we forward to callers; we own queryKey + queryFn. */
export type UsePaginatedQueryOptions<T> = Omit<
  UseQueryOptions<Page<T>, Error, Page<T>, readonly unknown[]>,
  'queryKey' | 'queryFn'
>

export function usePaginatedQuery<T>(
  path: string,
  query: ListQuery,
  options?: UsePaginatedQueryOptions<T>,
): UseQueryResult<Page<T>, Error> {
  return useQuery<Page<T>, Error, Page<T>, readonly unknown[]>({
    ...options,
    queryKey: paginatedQueryKey(path, query),
    queryFn: async () => {
      // openapi-fetch is strongly typed against `paths`, but here we accept any
      // path string because no concrete `Page<T>` endpoint exists in the schema
      // yet (see note on `Page<T>` above). The cast is intentionally narrow.
      const client = api as unknown as {
        GET: (
          p: string,
          init: { params: { query: ListQuery } },
        ) => Promise<{ data?: Page<T>; error?: unknown; response: Response }>
      }
      const { data, error, response } = await client.GET(path, { params: { query } })
      if (error || !data) {
        throw new Error(
          `Paginated request failed (${response.status} ${response.statusText}) for ${path}`,
        )
      }
      return data
    },
  })
}
