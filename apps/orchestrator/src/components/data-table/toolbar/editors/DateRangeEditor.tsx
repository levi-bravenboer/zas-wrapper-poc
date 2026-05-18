import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import type { ListFilter } from '@/hooks/use-data-table-state'

import { findOp } from '../chips'
import type { DataTableFilter } from '../Toolbar'

export interface DateRangeEditorProps<T> {
  def: DataTableFilter<T>
  current: ListFilter | ListFilter[] | undefined
  onChange: (field: string, filter: ListFilter | ListFilter[] | null) => void
}

export function DateRangeEditor<T>({ def, current, onChange }: DateRangeEditorProps<T>) {
  const { t } = useTranslation('data-table')
  if (def.type !== 'date-range') return null
  const gte = findOp(current, 'gte')
  const lte = findOp(current, 'lte')
  const from = gte ? String(gte.value) : ''
  const to = lte ? String(lte.value) : ''

  const commit = (nextFrom: string, nextTo: string) => {
    const parts: ListFilter[] = []
    if (nextFrom) parts.push({ op: 'gte', value: nextFrom })
    if (nextTo) parts.push({ op: 'lte', value: nextTo })
    if (parts.length === 0) {
      onChange(def.key, null)
      return
    }
    onChange(def.key, parts.length === 1 ? parts[0]! : parts)
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <label className="flex flex-col gap-1 text-xs text-foreground-muted">
        {t('toolbar.filters.dateRange.from', { label: def.label })}
        <Input
          type="date"
          value={from}
          onChange={(e) => commit(e.target.value, to)}
          className="h-9"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-foreground-muted">
        {t('toolbar.filters.dateRange.to', { label: def.label })}
        <Input
          type="date"
          value={to}
          onChange={(e) => commit(from, e.target.value)}
          className="h-9"
        />
      </label>
    </div>
  )
}
