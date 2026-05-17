import { useCallback } from 'react'

export interface UseTableSortParams {
  state: { orderBy: string | null; order: 'asc' | 'desc' }
  setSort: (orderBy: string | null, order: 'asc' | 'desc') => void
}

export interface UseTableSortApi {
  cycle: (sortKey: string) => void
  iconState: (sortKey: string) => 'asc' | 'desc' | null
  ariaSort: (sortKey: string) => 'ascending' | 'descending' | 'none'
}

export function useTableSort({ state, setSort }: UseTableSortParams): UseTableSortApi {
  const cycle = useCallback(
    (sortKey: string) => {
      if (state.orderBy !== sortKey) setSort(sortKey, 'asc')
      else if (state.order === 'asc') setSort(sortKey, 'desc')
      else setSort(null, 'asc')
    },
    [setSort, state.order, state.orderBy],
  )
  const iconState = useCallback(
    (sortKey: string) => (state.orderBy === sortKey ? state.order : null),
    [state.order, state.orderBy],
  )
  const ariaSort = useCallback(
    (sortKey: string) =>
      state.orderBy !== sortKey
        ? ('none' as const)
        : state.order === 'asc'
          ? ('ascending' as const)
          : ('descending' as const),
    [state.order, state.orderBy],
  )
  return { cycle, iconState, ariaSort }
}
