import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import type { Page } from '@/hooks/use-paginated-query'

/**
 * Resolve the currently-selected item for a picker by scanning every cached
 * page of the paginated list keyed under `['paginated', path, ...]`. Lets a
 * remounted picker render the selected label without issuing a fresh fetch,
 * provided the original list query is still in TanStack Query's cache.
 */
export function usePickerSelection<T>(
  path: string,
  value: string | null,
  pageItems: ReadonlyArray<T>,
  getId: (item: T) => string,
): T | null {
  const queryClient = useQueryClient()
  return useMemo(() => {
    if (!value) return null
    const current = pageItems.find((item) => getId(item) === value)
    if (current) return current
    const cached = queryClient.getQueriesData<Page<T>>({ queryKey: ['paginated', path] })
    for (const [, page] of cached) {
      if (!page) continue
      const hit = page.items.find((item) => getId(item) === value)
      if (hit) return hit
    }
    return null
  }, [getId, pageItems, path, queryClient, value])
}
