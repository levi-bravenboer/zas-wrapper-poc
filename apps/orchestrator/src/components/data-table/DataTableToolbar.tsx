import { useTranslation } from 'react-i18next'

import type { ListFilter } from '@/hooks/use-data-table-state'

import { ClearAll } from './toolbar/ClearAll'
import { DebouncedSearch } from './toolbar/DebouncedSearch'
import { FilterOverflow } from './toolbar/FilterOverflow'
import { FilterPill } from './toolbar/FilterPill'
import { Toolbar, type DataTableFilter } from './toolbar/Toolbar'

const INLINE_LIMIT = 3

export type { DataTableFilter }

export interface DataTableToolbarProps<T> {
  q: string | null
  filters: Record<string, ListFilter | ListFilter[]>
  filterDefs?: ReadonlyArray<DataTableFilter<T>>
  onSearchChange: (q: string | null) => void
  onFilterChange: (field: string, filter: ListFilter | ListFilter[] | null) => void
  onClearFilters: () => void
  className?: string
  searchPlaceholder?: string
  inlineLimit?: number
}

export function DataTableToolbar<T>({
  q,
  filters,
  filterDefs,
  onSearchChange,
  onFilterChange,
  onClearFilters,
  className,
  searchPlaceholder,
  inlineLimit = INLINE_LIMIT,
}: DataTableToolbarProps<T>) {
  const { t } = useTranslation('data-table')
  const defs = filterDefs ?? []
  const inline = defs.slice(0, inlineLimit)
  const overflow = defs.slice(inlineLimit)
  const hasActive = defs.some((def) => filters[def.key] !== undefined)

  return (
    <Toolbar.Root {...(className ? { className } : {})}>
      <Toolbar.Search>
        <DebouncedSearch
          value={q}
          onChange={onSearchChange}
          placeholder={searchPlaceholder ?? t('toolbar.search.placeholder')}
        />
      </Toolbar.Search>
      <Toolbar.Filters>
        {inline.map((def) => (
          <FilterPill key={def.key} def={def} value={filters[def.key]} onChange={onFilterChange} />
        ))}
        <FilterOverflow defs={overflow} filters={filters} onChange={onFilterChange} />
        {hasActive && <ClearAll onClick={onClearFilters} />}
      </Toolbar.Filters>
    </Toolbar.Root>
  )
}
