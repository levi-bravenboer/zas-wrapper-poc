import { X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ListFilter } from '@/hooks/use-data-table-state'
import { cn } from '@/lib/style/cn'

import { pillActive, pillEmpty, pillX } from '../styles'
import { summariseFilter } from './chips'
import { DateRangeEditor, MultiEditor, SelectEditor, TextEditor } from './editors'
import type { DataTableFilter } from './Toolbar'

export interface FilterPillProps<T> {
  def: DataTableFilter<T>
  value: ListFilter | ListFilter[] | undefined
  onChange: (field: string, filter: ListFilter | ListFilter[] | null) => void
}

export function FilterPill<T>({ def, value, onChange }: FilterPillProps<T>) {
  const { t } = useTranslation('data-table')
  const [open, setOpen] = useState(false)
  const summary = summariseFilter(def, value)
  const active = summary !== null

  const editor = (() => {
    switch (def.type) {
      case 'select':
        return <SelectEditor def={def} current={value} onChange={onChange} />
      case 'multi':
        return <MultiEditor def={def} current={value} onChange={onChange} />
      case 'date-range':
        return <DateRangeEditor def={def} current={value} onChange={onChange} />
      case 'text':
        return <TextEditor def={def} current={value} onChange={onChange} />
    }
  })()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn('inline-flex items-center', active ? pillActive : pillEmpty)}>
        <PopoverTrigger asChild>
          <button type="button" className="inline-flex items-center gap-1.5">
            <span className="text-primary/80">
              {def.label}
              {active ? ':' : ''}
            </span>
            {active ? (
              <span>{summary.display}</span>
            ) : (
              <span aria-hidden className="text-[10px] opacity-60">
                ▾
              </span>
            )}
          </button>
        </PopoverTrigger>
        {active ? (
          <button
            type="button"
            aria-label={t('toolbar.filters.pill.clearAria', { label: def.label })}
            className={pillX}
            onClick={() => onChange(def.key, null)}
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>
      <PopoverContent align="start" className="w-72 p-2">
        {editor}
      </PopoverContent>
    </Popover>
  )
}
