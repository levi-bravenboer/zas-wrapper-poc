import { describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'

import { dayGroupLabel, dueLabel } from './dueLabel'

const now = new Date(2026, 5, 12, 9, 0, 0)

function iso(daysFromNow: number, hour = 10): string {
  const d = new Date(now)
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

describe('dueLabel', () => {
  it('renders a past day as overdue, not today', () => {
    expect(dueLabel(i18n.t, iso(-1), now)).toMatch(/^verlopen /)
  })

  it('renders today / tomorrow / in N days', () => {
    expect(dueLabel(i18n.t, iso(0), now)).toMatch(/^vandaag /)
    expect(dueLabel(i18n.t, iso(1), now)).toMatch(/^morgen /)
    expect(dueLabel(i18n.t, iso(5), now)).toBe('over 5 dagen')
  })
})

describe('dayGroupLabel', () => {
  it('groups past days under Verlopen', () => {
    expect(dayGroupLabel(i18n.t, iso(-1), now)).toBe('Verlopen')
  })

  it('groups today and tomorrow under relative labels', () => {
    expect(dayGroupLabel(i18n.t, iso(0), now)).toBe('Vandaag')
    expect(dayGroupLabel(i18n.t, iso(1), now)).toBe('Morgen')
  })
})
