import type { ListFilter } from '@/hooks/use-data-table-state'

import { findOp } from '../chips'
import type { DataTableFilter } from '../Toolbar'

export interface TypeaheadEditorProps<T> {
  def: DataTableFilter<T>
  current: ListFilter | ListFilter[] | undefined
  onChange: (field: string, filter: ListFilter | ListFilter[] | null) => void
}

export function TypeaheadEditor<T>({ def, current, onChange }: TypeaheadEditorProps<T>) {
  if (def.type !== 'typeahead') return null
  const active = findOp(current, 'eq')
  const value = active ? String(active.value) : null
  return def.renderEditor({
    value,
    onChange: (next) => {
      if (next === null || next === '') onChange(def.key, null)
      else onChange(def.key, { op: 'eq', value: next })
    },
  })
}
