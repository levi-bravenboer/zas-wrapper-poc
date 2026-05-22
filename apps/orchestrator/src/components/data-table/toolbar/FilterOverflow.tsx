import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ListFilter } from '@/hooks/use-data-table-state'

import { FilterPill } from './FilterPill'
import type { DataTableFilter } from './Toolbar'

export interface FilterOverflowProps<T> {
  defs: ReadonlyArray<DataTableFilter<T>>
  filters: Record<string, ListFilter | ListFilter[]>
  onChange: (field: string, filter: ListFilter | ListFilter[] | null) => void
}

export function FilterOverflow<T>({ defs, filters, onChange }: FilterOverflowProps<T>) {
  const { t } = useTranslation('data-table')
  if (defs.length === 0) return null
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 border-dashed font-normal">
          <span>{t('toolbar.filters.more', { count: defs.length })}</span>
          <ChevronDown aria-hidden className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-2 p-2">
        {defs.map((def) => (
          <FilterPill key={def.key} def={def} value={filters[def.key]} onChange={onChange} />
        ))}
      </PopoverContent>
    </Popover>
  )
}
