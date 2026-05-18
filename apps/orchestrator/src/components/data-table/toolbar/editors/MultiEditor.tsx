import type { ListFilter } from '@/hooks/use-data-table-state'
import { cn } from '@/lib/style/cn'

import { findOp } from '../chips'
import type { DataTableFilter } from '../Toolbar'

export interface MultiEditorProps<T> {
  def: DataTableFilter<T>
  current: ListFilter | ListFilter[] | undefined
  onChange: (field: string, filter: ListFilter | ListFilter[] | null) => void
}

export function MultiEditor<T>({ def, current, onChange }: MultiEditorProps<T>) {
  if (def.type !== 'multi') return null
  const active = findOp(current, 'in')
  const selected = new Set<string>(
    active ? (Array.isArray(active.value) ? active.value : [active.value]).map(String) : [],
  )
  const toggle = (v: string) => {
    const next = new Set(selected)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    if (next.size === 0) {
      onChange(def.key, null)
      return
    }
    onChange(def.key, { op: 'in', value: Array.from(next) })
  }
  return (
    <div className="flex flex-col gap-1 p-1">
      {def.options.map((opt) => {
        const checked = selected.has(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={cn(
              'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left outline-none',
              'hover:bg-surface-2',
              checked && 'bg-surface-2 font-medium',
            )}
          >
            <span
              className={cn(
                'inline-flex h-4 w-4 items-center justify-center rounded-sm border border-input',
                checked && 'bg-primary text-primary-foreground',
              )}
              aria-hidden
            >
              {checked ? '✓' : ''}
            </span>
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
