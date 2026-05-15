import { type BrandedColumnDef, type DataTableColumnDef } from './types'

/**
 * Define a `DataTable` column. Thin pass-through that exists so consumers
 * import from a single place and so the brand can be applied centrally.
 */
export function defineColumn<T>(def: DataTableColumnDef<T>): BrandedColumnDef<T> {
  return def as BrandedColumnDef<T>
}

/**
 * Convenience helper for the common case of "render a string property". Keeps
 * type-safety on `key` without forcing the caller to write a closure.
 */
export function textColumn<T, K extends keyof T>(
  id: string,
  header: DataTableColumnDef<T>['header'],
  key: K,
  extra?: Omit<DataTableColumnDef<T>, 'id' | 'header' | 'cell'>,
): BrandedColumnDef<T> {
  return defineColumn<T>({
    id,
    header,
    cell: (row) => String(row[key] ?? ''),
    ...extra,
  })
}

export type { DataTableColumnDef, BrandedColumnDef } from './types'
