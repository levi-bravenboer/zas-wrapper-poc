import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'

import {
  DATA_TABLE_DEFAULT_STATE,
  dataTableReducer,
  mergeInitialState,
  type DataTableAction,
  type DataTableDispatch,
  type DataTableState,
  type ListFilter,
} from './use-data-table-state'

/**
 * URL-backed DataTable state.
 *
 * The hook reads the current state from the active route's search params via
 * `useSearch({ strict: false })` and writes updates with
 * `useNavigate()({ search: (prev) => ... })`. The router is expected to be the
 * source of truth — this means dispatching `setPage(3)` triggers a navigation
 * which then re-renders the hook with the new state.
 *
 * Schema handling: the caller can pass any object with a `.parse()` method
 * (Zod, Valibot, Standard Schema, etc.). If supplied it is run as a coercion
 * shim — invalid values fall back to the defaults so the hook never throws on
 * a stale or hand-crafted URL. When omitted we do a minimal best-effort coerce
 * on the raw search object.
 *
 * Composition with localStorage: see `composeTableState` below. The URL wins
 * for every field it owns; localStorage supplies fallbacks for the rest.
 */

interface SearchCoercer {
  parse: (value: unknown) => Partial<DataTableState>
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

function coerceFilters(value: unknown): DataTableState['filters'] {
  if (!isPlainObject(value)) return {}
  const out: DataTableState['filters'] = {}
  for (const [field, raw] of Object.entries(value)) {
    if (Array.isArray(raw)) {
      const filtered = raw.filter(isListFilter)
      if (filtered.length) out[field] = filtered
    } else if (isListFilter(raw)) {
      out[field] = raw
    }
  }
  return out
}

/**
 * Best-effort coercion from an unknown search object into a partial
 * `DataTableState`. Unknown / malformed fields are dropped silently.
 */
function coerceSearchToState(search: unknown): Partial<DataTableState> {
  if (!isPlainObject(search)) return {}
  const out: Partial<DataTableState> = {}
  if (typeof search['page'] === 'number') out.page = search['page']
  else if (typeof search['page'] === 'string' && search['page'] !== '') {
    const n = Number(search['page'])
    if (Number.isFinite(n)) out.page = n
  }
  if (typeof search['pageSize'] === 'number') out.pageSize = search['pageSize']
  else if (typeof search['pageSize'] === 'string' && search['pageSize'] !== '') {
    const n = Number(search['pageSize'])
    if (Number.isFinite(n)) out.pageSize = n
  }
  if (typeof search['q'] === 'string') out.q = search['q']
  else if (search['q'] === null) out.q = null
  if (typeof search['orderBy'] === 'string') out.orderBy = search['orderBy']
  else if (search['orderBy'] === null) out.orderBy = null
  if (search['order'] === 'asc' || search['order'] === 'desc') out.order = search['order']
  if ('filters' in search) out.filters = coerceFilters(search['filters'])
  return out
}

function applyAction(state: DataTableState, action: DataTableAction): DataTableState {
  return dataTableReducer(state, action)
}

/**
 * URL-backed table state. The optional `schema` argument is any object with a
 * `parse(value) => Partial<DataTableState>` method; see `SearchCoercer`.
 */
export function useRouteSearchTableState(
  schema?: SearchCoercer,
): readonly [DataTableState, DataTableDispatch] {
  // We read the loose, unvalidated search object so this hook is usable from
  // any route regardless of its `validateSearch` shape.
  const rawSearch = useSearch({ strict: false }) as unknown
  const navigate = useNavigate()

  const state = useMemo<DataTableState>(() => {
    const partial = schema ? schema.parse(rawSearch) : coerceSearchToState(rawSearch)
    return mergeInitialState(partial)
  }, [rawSearch, schema])

  const apply = useCallback(
    (action: DataTableAction) => {
      void navigate({
        // `prev` is the typed search of the active route; we coerce to a
        // plain object so we can merge in our own keys without fighting the
        // route's per-field schema.
        search: ((prev: unknown) => {
          const prevObj = isPlainObject(prev) ? prev : {}
          const current = mergeInitialState(
            schema ? schema.parse(prevObj) : coerceSearchToState(prevObj),
          )
          const next = applyAction(current, action)
          return { ...prevObj, ...serialiseState(next) }
        }) as never,
      })
    },
    [navigate, schema],
  )

  const setPage = useCallback((page: number) => apply({ type: 'setPage', page }), [apply])
  const setPageSize = useCallback(
    (pageSize: number) => apply({ type: 'setPageSize', pageSize }),
    [apply],
  )
  const setSearchValue = useCallback((q: string | null) => apply({ type: 'setSearch', q }), [apply])
  const setSort = useCallback(
    (orderBy: string, order: 'asc' | 'desc') => apply({ type: 'setSort', orderBy, order }),
    [apply],
  )
  const clearSort = useCallback(() => apply({ type: 'clearSort' }), [apply])
  const setFilter = useCallback(
    (field: string, filter: ListFilter | ListFilter[]) =>
      apply({ type: 'setFilter', field, filter }),
    [apply],
  )
  const clearFilter = useCallback((field: string) => apply({ type: 'clearFilter', field }), [apply])
  const clearAll = useCallback(() => apply({ type: 'clearAll' }), [apply])
  const reset = useCallback(
    (next?: Partial<DataTableState>) =>
      apply(next === undefined ? { type: 'reset' } : { type: 'reset', initial: next }),
    [apply],
  )

  const dispatch = useMemo<DataTableDispatch>(
    () => ({
      setPage,
      setPageSize,
      setSearch: setSearchValue,
      setSort,
      clearSort,
      setFilter,
      clearFilter,
      clearAll,
      reset,
    }),
    [
      setPage,
      setPageSize,
      setSearchValue,
      setSort,
      clearSort,
      setFilter,
      clearFilter,
      clearAll,
      reset,
    ],
  )

  return [state, dispatch] as const
}

/**
 * Serialise state for round-tripping through the URL. Fields whose value
 * matches the default are emitted as `undefined` so TanStack Router strips
 * them from the URL. Emitting `undefined` (rather than omitting the key)
 * matters when merging into a previous search object — otherwise stale
 * values from prior state would survive transitions like
 * `q: "foo"` → `q: null` or `filters: {a}` → `clearAll()`.
 */
function serialiseState(state: DataTableState): Record<string, unknown> {
  return {
    page: state.page !== DATA_TABLE_DEFAULT_STATE.page ? state.page : undefined,
    pageSize: state.pageSize !== DATA_TABLE_DEFAULT_STATE.pageSize ? state.pageSize : undefined,
    q: state.q !== DATA_TABLE_DEFAULT_STATE.q ? state.q : undefined,
    orderBy: state.orderBy !== DATA_TABLE_DEFAULT_STATE.orderBy ? state.orderBy : undefined,
    order: state.order !== DATA_TABLE_DEFAULT_STATE.order ? state.order : undefined,
    filters: Object.keys(state.filters).length ? state.filters : undefined,
  }
}

export { serialiseState as __serialiseTableStateForTest }
