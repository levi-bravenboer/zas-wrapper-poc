import { Input } from '@/components/ui/input'
import type { ListFilter } from '@/hooks/use-data-table-state'

import { findOp } from '../chips'
import type { DataTableFilter } from '../Toolbar'

export interface TextEditorProps<T> {
  def: DataTableFilter<T>
  current: ListFilter | ListFilter[] | undefined
  onChange: (field: string, filter: ListFilter | ListFilter[] | null) => void
}

export function TextEditor<T>({ def, current, onChange }: TextEditorProps<T>) {
  if (def.type !== 'text') return null
  const active = findOp(current, 'contains')
  const value = active ? String(active.value) : ''
  return (
    <div className="p-2">
      <Input
        type="text"
        value={value}
        placeholder={def.label}
        onChange={(e) => {
          const next = e.target.value
          if (next.trim().length === 0) onChange(def.key, null)
          else onChange(def.key, { op: 'contains', value: next })
        }}
        className="h-9"
      />
    </div>
  )
}
