/**
 * Canonical query-key factory for paginated list endpoints.
 *
 * Two `ListQuery` values that describe the *same* logical query but were
 * constructed with fields in different insertion orders (e.g. JSON.parse from
 * the URL vs. an in-memory builder) must produce a structurally identical
 * query key. Otherwise React Query treats them as distinct cache entries and
 * we refetch on every navigation — defeating the cache and causing UI flicker.
 *
 * Canonicalisation rules applied here:
 * - Filter field names are sorted alphabetically.
 * - For each field, when multiple `ListFilter`s are given they are normalised
 *   to a sorted-by-operator tuple.
 * - Each filter `value`, when array-valued, is sorted (stable string compare).
 *
 * Primitive query fields (page, page_size, q, order_by, order) are emitted in
 * a fixed positional tuple so insertion order never matters.
 */

export type ListFilterOperator = 'eq' | 'in' | 'gte' | 'lte' | 'contains' | 'not'

export type ListFilterPrimitive = string | number | boolean
export type ListFilterValue = ListFilterPrimitive | ReadonlyArray<ListFilterPrimitive>

export interface ListFilter {
  op: ListFilterOperator
  value: ListFilterValue
}

export interface ListQuery {
  page?: number
  page_size?: number
  q?: string | null
  order_by?: string | null
  order?: 'asc' | 'desc'
  filters?: Record<string, ListFilter | ListFilter[]>
}

function compareValues(a: ListFilterPrimitive, b: ListFilterPrimitive): number {
  const sa = String(a)
  const sb = String(b)
  if (sa < sb) return -1
  if (sa > sb) return 1
  return 0
}

function canonicalValue(value: ListFilterValue): ListFilterValue {
  if (Array.isArray(value)) {
    // Sort by string projection so mixed primitive arrays compare stably.
    return [...value].sort(compareValues)
  }
  return value
}

type CanonicalFilter = readonly [ListFilterOperator, ListFilterValue]

function canonicalFiltersFor(input: ListFilter | ListFilter[]): readonly CanonicalFilter[] {
  const list = Array.isArray(input) ? input : [input]
  return list
    .map((f): CanonicalFilter => [f.op, canonicalValue(f.value)])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
}

function canonicalFilters(
  filters: Record<string, ListFilter | ListFilter[]> | undefined,
): ReadonlyArray<readonly [string, ReadonlyArray<CanonicalFilter>]> {
  if (!filters) return []
  const fields = Object.keys(filters).sort()
  return fields.map((field) => {
    const raw = filters[field]
    // raw cannot be undefined because we iterated over its own keys, but
    // narrow for noUncheckedIndexedAccess.
    return [field, raw ? canonicalFiltersFor(raw) : []] as const
  })
}

export function paginatedQueryKey(path: string, query: ListQuery): readonly unknown[] {
  return [
    'paginated',
    path,
    query.page ?? null,
    query.page_size ?? null,
    query.q ?? null,
    query.order_by ?? null,
    query.order ?? null,
    canonicalFilters(query.filters),
  ] as const
}
