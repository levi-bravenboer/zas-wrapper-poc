import type { ReactElement, ReactNode } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'

export type FilterableListPageProps = {
  title: ReactNode
  description?: ReactNode
  primaryAction?: ReactNode
  filters?: ReactNode
  table: ReactNode
  /**
   * Rendered in place of `table` when the consumer indicates an empty,
   * unfiltered result set. The scaffolding does not infer emptiness — the
   * consumer signals it via `isEmpty`.
   */
  emptyState?: ReactNode
  /**
   * True when the underlying `<DataTable>` reports zero rows AND the consumer
   * has no active filters/search. Used to decide whether to swap `table` for
   * `emptyState`. Default: `false` (always render `table`).
   */
  isEmpty?: boolean
  /**
   * Optional decorative mint blur orb mirroring `UserHero`. Default: `false`.
   */
  accent?: boolean
}

/**
 * Generic chrome for filterable list surfaces — title row, filter row,
 * `<DataTable>` slot, optional unfiltered empty-state.
 *
 * Layout only. Owns no data, query state, or pagination — those live in the
 * consumer's `<DataTable<T>>` instance plus its `usePaginatedQuery` call.
 */
export function FilterableListPage<_T>({
  title,
  description,
  primaryAction,
  filters,
  table,
  emptyState,
  isEmpty = false,
  accent = false,
}: FilterableListPageProps): ReactElement {
  const showEmptyState = isEmpty && emptyState !== undefined

  return (
    <>
      <PageHeader title={title} sub={description} />
      <div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-8">
        {accent && (
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-4 size-40 rounded-full bg-primary/10 blur-3xl"
          />
        )}
        {(filters !== undefined || primaryAction !== undefined) && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">{filters}</div>
            {primaryAction && (
              <div className="flex shrink-0 items-center gap-2">{primaryAction}</div>
            )}
          </div>
        )}
        {showEmptyState ? emptyState : table}
      </div>
    </>
  )
}
