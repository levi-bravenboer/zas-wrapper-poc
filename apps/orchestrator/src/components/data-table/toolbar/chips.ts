import type { ListFilter, ListFilterOperator } from '@/hooks/use-data-table-state'

import type { DataTableFilter } from './Toolbar'

export function findOp(
  value: ListFilter | ListFilter[] | undefined,
  op: ListFilterOperator,
): ListFilter | undefined {
  if (!value) return undefined
  if (Array.isArray(value)) return value.find((f) => f.op === op)
  return value.op === op ? value : undefined
}

function primitiveToString(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ')
  return String(v)
}

export interface ChipSummary {
  display: string
}

export function summariseFilter<T>(
  def: DataTableFilter<T>,
  value: ListFilter | ListFilter[] | undefined,
): ChipSummary | null {
  if (!value) return null
  switch (def.type) {
    case 'select': {
      const f = findOp(value, 'eq')
      if (!f) return null
      const opt = def.options.find((o) => o.value === String(f.value))
      return { display: opt?.label ?? primitiveToString(f.value) }
    }
    case 'multi': {
      const f = findOp(value, 'in')
      if (!f) return null
      const values = Array.isArray(f.value) ? f.value : [f.value]
      const display = values
        .map((v) => def.options.find((o) => o.value === String(v))?.label ?? String(v))
        .join(', ')
      return { display }
    }
    case 'date-range': {
      const gte = findOp(value, 'gte')
      const lte = findOp(value, 'lte')
      if (!gte && !lte) return null
      const from = gte ? primitiveToString(gte.value) : '…'
      const to = lte ? primitiveToString(lte.value) : '…'
      return { display: `${from} – ${to}` }
    }
    case 'text': {
      const f = findOp(value, 'contains')
      if (!f) return null
      return { display: primitiveToString(f.value) }
    }
    case 'typeahead': {
      const f = findOp(value, 'eq')
      if (!f) return null
      const raw = primitiveToString(f.value)
      const formatted = def.formatValue ? def.formatValue(raw) : null
      return { display: formatted ?? raw }
    }
    case 'boolean': {
      const f = findOp(value, 'eq')
      if (!f) return null
      const truthy = f.value === true || f.value === 'true'
      const trueLabel = def.trueLabel ?? 'Yes'
      const falseLabel = def.falseLabel ?? 'No'
      return { display: truthy ? trueLabel : falseLabel }
    }
  }
}
