import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ListFilter } from '@/hooks/use-data-table-state'

import { findOp } from '../chips'
import type { DataTableFilter } from '../Toolbar'

export interface SelectEditorProps<T> {
  def: DataTableFilter<T>
  current: ListFilter | ListFilter[] | undefined
  onChange: (field: string, filter: ListFilter | ListFilter[] | null) => void
}

export function SelectEditor<T>({ def, current, onChange }: SelectEditorProps<T>) {
  if (def.type !== 'select') return null
  const active = findOp(current, 'eq')
  const value = active ? String(active.value) : ''
  const selectProps: { value?: string; onValueChange: (v: string) => void } = {
    onValueChange: (v) => onChange(def.key, { op: 'eq', value: v }),
  }
  if (value) selectProps.value = value
  return (
    <Select {...selectProps}>
      <SelectTrigger className="h-9">
        <SelectValue placeholder={def.label} />
      </SelectTrigger>
      <SelectContent>
        {def.options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
