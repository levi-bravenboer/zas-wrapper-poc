import { describe, expect, it } from 'vitest'

import { summariseFilter } from './chips'
import type { DataTableFilter } from './Toolbar'

const selectDef: DataTableFilter<{ role: string }> = {
  type: 'select',
  key: 'role',
  label: 'Role',
  options: [
    { value: 'admin', label: 'Admin' },
    { value: 'caregiver', label: 'Caregiver' },
  ],
}

describe('summariseFilter', () => {
  it('select → maps value to option label', () => {
    expect(summariseFilter(selectDef, { op: 'eq', value: 'admin' })).toEqual({ display: 'Admin' })
  })

  it('select → returns null when no `eq` op', () => {
    expect(summariseFilter(selectDef, { op: 'in', value: ['admin'] })).toBeNull()
  })

  it('multi → joins multiple labels by ", "', () => {
    const def: DataTableFilter<{ k: string }> = {
      type: 'multi',
      key: 'k',
      label: 'K',
      options: [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
      ],
    }
    expect(summariseFilter(def, { op: 'in', value: ['a', 'b'] })).toEqual({
      display: 'Alpha, Beta',
    })
  })

  it('date-range → "from – to" with placeholders', () => {
    const def: DataTableFilter<{ k: string }> = { type: 'date-range', key: 'k', label: 'D' }
    expect(
      summariseFilter(def, [
        { op: 'gte', value: '2025-01-01' },
        { op: 'lte', value: '2025-12-31' },
      ]),
    ).toEqual({ display: '2025-01-01 – 2025-12-31' })
  })

  it('text → string passthrough', () => {
    const def: DataTableFilter<{ k: string }> = { type: 'text', key: 'k', label: 'T' }
    expect(summariseFilter(def, { op: 'contains', value: 'hello' })).toEqual({ display: 'hello' })
  })

  it('returns null when value is undefined', () => {
    expect(summariseFilter(selectDef, undefined)).toBeNull()
  })
})
