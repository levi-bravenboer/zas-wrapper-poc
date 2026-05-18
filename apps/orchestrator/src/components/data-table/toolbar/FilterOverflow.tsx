import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import type { ListFilter } from '@/hooks/use-data-table-state'

import { pillEmpty } from '../styles'
import { DateRangeEditor, MultiEditor, SelectEditor, TextEditor } from './editors'
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
      <PopoverTrigger className={pillEmpty}>
        <span>{t('toolbar.filters.more', { count: defs.length })}</span>
        <span aria-hidden className="text-[10px] opacity-60">
          ▾
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        {defs.map((def, i) => (
          <Fragment key={def.key}>
            {i > 0 ? <Separator className="my-2" /> : null}
            <div className="px-1 text-xs font-medium text-foreground-muted">{def.label}</div>
            {def.type === 'select' ? (
              <SelectEditor def={def} current={filters[def.key]} onChange={onChange} />
            ) : null}
            {def.type === 'multi' ? (
              <MultiEditor def={def} current={filters[def.key]} onChange={onChange} />
            ) : null}
            {def.type === 'date-range' ? (
              <DateRangeEditor def={def} current={filters[def.key]} onChange={onChange} />
            ) : null}
            {def.type === 'text' ? (
              <TextEditor def={def} current={filters[def.key]} onChange={onChange} />
            ) : null}
          </Fragment>
        ))}
      </PopoverContent>
    </Popover>
  )
}
