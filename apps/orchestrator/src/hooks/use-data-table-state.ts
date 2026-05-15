import { useCallback, useMemo, useReducer } from 'react'

/**
 * Mirrors the backend `ListQuery` shape (apps/backend/app/schemas/_list/list_query.py)
 * so the same object can be shipped over the wire after a minimal field-name
 * mapping (q -> q, orderBy -> order_by, etc.).
 *
 * This module is intentionally framework-agnostic: it only owns the reducer
 * and the dispatcher. The route/local-storage wrappers re-export the same
 * helpers and bind them to their respective sources of truth.
 */

export type ListFilterOperator = 'eq' | 'in' | 'gte' | 'lte' | 'contains' | 'not'

export type ListFilterPrimitive = string | number | boolean
export type ListFilterValue = ListFilterPrimitive | ReadonlyArray<ListFilterPrimitive>

export interface ListFilter {
  op: ListFilterOperator
  value: ListFilterValue
}

export interface DataTableState {
  page: number
  pageSize: number
  q: string | null
  orderBy: string | null
  order: 'asc' | 'desc'
  filters: Record<string, ListFilter | ListFilter[]>
}

export const DATA_TABLE_DEFAULT_STATE: DataTableState = {
  page: 1,
  pageSize: 25,
  q: null,
  orderBy: null,
  order: 'asc',
  filters: {},
}

export type DataTableAction =
  | { type: 'setPage'; page: number }
  | { type: 'setPageSize'; pageSize: number }
  | { type: 'setSearch'; q: string | null }
  | { type: 'setSort'; orderBy: string; order: 'asc' | 'desc' }
  | { type: 'clearSort' }
  | { type: 'setFilter'; field: string; filter: ListFilter | ListFilter[] }
  | { type: 'clearFilter'; field: string }
  | { type: 'clearAll' }
  | { type: 'reset'; initial?: Partial<DataTableState> }

export interface DataTableDispatch {
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  setSearch: (q: string | null) => void
  setSort: (orderBy: string, order: 'asc' | 'desc') => void
  clearSort: () => void
  setFilter: (field: string, filter: ListFilter | ListFilter[]) => void
  clearFilter: (field: string) => void
  clearAll: () => void
  reset: (initial?: Partial<DataTableState>) => void
}

export function mergeInitialState(initial?: Partial<DataTableState>): DataTableState {
  if (!initial) return { ...DATA_TABLE_DEFAULT_STATE }
  return {
    ...DATA_TABLE_DEFAULT_STATE,
    ...initial,
    filters: { ...DATA_TABLE_DEFAULT_STATE.filters, ...(initial.filters ?? {}) },
  }
}

export function dataTableReducer(state: DataTableState, action: DataTableAction): DataTableState {
  switch (action.type) {
    case 'setPage':
      if (state.page === action.page) return state
      return { ...state, page: action.page }
    case 'setPageSize':
      if (state.pageSize === action.pageSize) return state
      // Reset to first page so users do not land on a non-existent page.
      return { ...state, pageSize: action.pageSize, page: 1 }
    case 'setSearch':
      if (state.q === action.q) return state
      return { ...state, q: action.q, page: 1 }
    case 'setSort':
      if (state.orderBy === action.orderBy && state.order === action.order) return state
      return { ...state, orderBy: action.orderBy, order: action.order }
    case 'clearSort':
      if (state.orderBy === null) return state
      return { ...state, orderBy: null, order: 'asc' }
    case 'setFilter': {
      const next = { ...state.filters, [action.field]: action.filter }
      return { ...state, filters: next, page: 1 }
    }
    case 'clearFilter': {
      if (!(action.field in state.filters)) return state
      const next = { ...state.filters }
      delete next[action.field]
      return { ...state, filters: next, page: 1 }
    }
    case 'clearAll':
      return {
        ...DATA_TABLE_DEFAULT_STATE,
        pageSize: state.pageSize,
      }
    case 'reset':
      return mergeInitialState(action.initial)
    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}

/**
 * Local reducer-backed table state. Use this when neither the URL nor
 * localStorage should observe the table state (e.g. a transient drawer).
 */
export function useDataTableState(
  initial?: Partial<DataTableState>,
): readonly [DataTableState, DataTableDispatch] {
  const [state, rawDispatch] = useReducer(
    dataTableReducer,
    initial,
    mergeInitialState as (i?: Partial<DataTableState>) => DataTableState,
  )

  const setPage = useCallback((page: number) => rawDispatch({ type: 'setPage', page }), [])
  const setPageSize = useCallback(
    (pageSize: number) => rawDispatch({ type: 'setPageSize', pageSize }),
    [],
  )
  const setSearch = useCallback(
    (q: string | null) => rawDispatch({ type: 'setSearch', q }),
    [],
  )
  const setSort = useCallback(
    (orderBy: string, order: 'asc' | 'desc') => rawDispatch({ type: 'setSort', orderBy, order }),
    [],
  )
  const clearSort = useCallback(() => rawDispatch({ type: 'clearSort' }), [])
  const setFilter = useCallback(
    (field: string, filter: ListFilter | ListFilter[]) =>
      rawDispatch({ type: 'setFilter', field, filter }),
    [],
  )
  const clearFilter = useCallback(
    (field: string) => rawDispatch({ type: 'clearFilter', field }),
    [],
  )
  const clearAll = useCallback(() => rawDispatch({ type: 'clearAll' }), [])
  const reset = useCallback(
    (next?: Partial<DataTableState>) =>
      rawDispatch(next === undefined ? { type: 'reset' } : { type: 'reset', initial: next }),
    [],
  )

  const dispatch = useMemo<DataTableDispatch>(
    () => ({
      setPage,
      setPageSize,
      setSearch,
      setSort,
      clearSort,
      setFilter,
      clearFilter,
      clearAll,
      reset,
    }),
    [setPage, setPageSize, setSearch, setSort, clearSort, setFilter, clearFilter, clearAll, reset],
  )

  return [state, dispatch] as const
}
