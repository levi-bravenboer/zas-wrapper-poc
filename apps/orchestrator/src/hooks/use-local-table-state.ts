import { useCallback, useEffect, useMemo, useReducer } from 'react'

import {
  DATA_TABLE_DEFAULT_STATE,
  dataTableReducer,
  mergeInitialState,
  type DataTableDispatch,
  type DataTableState,
  type ListFilter,
} from './use-data-table-state'

/**
 * localStorage-backed DataTable state.
 *
 * On mount the hook hydrates from `localStorage.getItem('data-table:<tableId>')`,
 * falling back to `initial` and then to `DATA_TABLE_DEFAULT_STATE`. Writes are
 * debounced 200 ms so rapid dispatches (e.g. typing into the search box) do
 * not thrash the storage backend.
 *
 * Composition with route-based state: see `composeTableState` in
 * `use-route-search-table-state.ts`. The convention is that the URL is the
 * source of truth for fields it owns; localStorage supplies fallbacks for
 * everything else (typically `pageSize` and persisted column filters).
 */

const STORAGE_PREFIX = 'data-table:'
const DEBOUNCE_MS = 200

export function storageKeyFor(tableId: string): string {
  return `${STORAGE_PREFIX}${tableId}`
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isListFilter(value: unknown): value is ListFilter {
  if (!isPlainObject(value)) return false
  const op = value['op']
  return (
    op === 'eq' || op === 'in' || op === 'gte' || op === 'lte' || op === 'contains' || op === 'not'
  )
}

function parseFilters(raw: unknown): DataTableState['filters'] {
  if (!isPlainObject(raw)) return {}
  const out: DataTableState['filters'] = {}
  for (const [field, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      const filtered = value.filter(isListFilter)
      if (filtered.length) out[field] = filtered
    } else if (isListFilter(value)) {
      out[field] = value
    }
  }
  return out
}

/**
 * Parse a JSON payload into a `DataTableState`. Unknown / malformed fields are
 * dropped silently so a corrupted storage entry can never crash the table.
 */
export function parseStoredState(raw: string | null): Partial<DataTableState> | null {
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isPlainObject(parsed)) return null

  const out: Partial<DataTableState> = {}
  if (typeof parsed['page'] === 'number') out.page = parsed['page']
  if (typeof parsed['pageSize'] === 'number') out.pageSize = parsed['pageSize']
  if (typeof parsed['q'] === 'string' || parsed['q'] === null) out.q = parsed['q'] as string | null
  if (typeof parsed['orderBy'] === 'string' || parsed['orderBy'] === null) {
    out.orderBy = parsed['orderBy'] as string | null
  }
  if (parsed['order'] === 'asc' || parsed['order'] === 'desc') out.order = parsed['order']
  if ('filters' in parsed) out.filters = parseFilters(parsed['filters'])
  return out
}

function readFromStorage(tableId: string): Partial<DataTableState> | null {
  if (typeof window === 'undefined') return null
  try {
    return parseStoredState(window.localStorage.getItem(storageKeyFor(tableId)))
  } catch {
    return null
  }
}

function initialiseState(
  tableId: string,
  initial: Partial<DataTableState> | undefined,
): DataTableState {
  const stored = readFromStorage(tableId)
  if (stored !== null) {
    return mergeInitialState({ ...(initial ?? {}), ...stored })
  }
  return mergeInitialState(initial)
}

export function useLocalTableState(
  tableId: string,
  initial?: Partial<DataTableState>,
): readonly [DataTableState, DataTableDispatch] {
  const [state, rawDispatch] = useReducer(
    dataTableReducer,
    undefined,
    (): DataTableState => initialiseState(tableId, initial),
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKeyFor(tableId), JSON.stringify(state))
      } catch {
        // ignore quota / serialisation errors — the table still works in-memory.
      }
    }, DEBOUNCE_MS)
    return () => {
      window.clearTimeout(handle)
    }
  }, [tableId, state])

  const setPage = useCallback((page: number) => rawDispatch({ type: 'setPage', page }), [])
  const setPageSize = useCallback(
    (pageSize: number) => rawDispatch({ type: 'setPageSize', pageSize }),
    [],
  )
  const setSearch = useCallback((q: string | null) => rawDispatch({ type: 'setSearch', q }), [])
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

export { DATA_TABLE_DEFAULT_STATE }
