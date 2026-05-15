import { type ReactNode } from 'react'

import { type DataTableState } from '@/hooks/use-data-table-state'

/** Action descriptor for the row actions dropdown. */
export interface DataTableRowAction {
  label: ReactNode
  icon?: ReactNode
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
}

/** Row identity extractor. */
export type GetRowId<T> = (row: T) => string

/**
 * Branded `ColumnDef<T>` accepted by `DataTable`. Created via the helpers in
 * `./columns` so consumers cannot hand-roll columns that bypass our metadata.
 */
export interface DataTableColumnDef<T> {
  /** Stable column identifier (also used as the React key). */
  id: string
  /** Header text or render fn. */
  header: ReactNode | ((ctx: { columnId: string }) => ReactNode)
  /** Cell renderer. */
  cell: (row: T) => ReactNode
  /** Field used for backend sorting; column is sortable iff this is set. */
  sortKey?: string
  /** Field used for backend filtering (metadata only — DataTable does not render filters itself). */
  filterKey?: string
  /** When `true`, the column gets sticky left-side positioning. The first column is sticky by default. */
  sticky?: boolean
  /** Hint for responsive priority (callers may use it to hide low-priority columns). */
  priority?: number
  /** Extra class names applied to both `<th>` and `<td>`. */
  className?: string
}

/** Marker brand to make sure helper-produced columns are accepted. */
declare const dataTableColumnBrand: unique symbol
export type BrandedColumnDef<T> = DataTableColumnDef<T> & {
  readonly [dataTableColumnBrand]?: never
}

/**
 * Realtime topic typing helper. A `DataTable` declares the topic it expects to
 * be refreshed by; the consumer's `usePaginatedQuery` call must use the same
 * resource prefix as the leading element of its query key. This is a
 * documentation prop — no subscription is opened by the table itself.
 */
export type RealtimeTopic = string

/** Controlled-state surface. */
export interface DataTableStateControl {
  state: DataTableState
  onStateChange: (next: DataTableState) => void
}
