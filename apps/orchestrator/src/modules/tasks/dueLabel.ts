import type { TFunction } from 'i18next'

import { intlLocale } from '@/lib/i18n'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

const timeFormatter = (): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(intlLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  })

const dayFormatter = (): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(intlLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

function localDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function deltaDays(dueAtIso: string, now: Date): number {
  const due = new Date(dueAtIso)
  return Math.round((localDateOnly(due).getTime() - localDateOnly(now).getTime()) / ONE_DAY_MS)
}

/**
 * Localised "due-at" copy for a task row.
 *
 * Past day → "verlopen"
 * Today → "vandaag {time}"
 * Tomorrow → "morgen {time}"
 * Further out → "over {n} dagen"
 */
export function dueLabel(t: TFunction, dueAtIso: string, now: Date = new Date()): string {
  const due = new Date(dueAtIso)
  const delta = deltaDays(dueAtIso, now)

  if (delta < 0) {
    return t('tasks:due.overdue', { time: timeFormatter().format(due) })
  }
  if (delta === 0) {
    return t('tasks:due.today', { time: timeFormatter().format(due) })
  }
  if (delta === 1) {
    return t('tasks:due.tomorrow', { time: timeFormatter().format(due) })
  }
  return t('tasks:due.in_days', { count: delta })
}

/**
 * Calendar-day group label for the rail (D-FLAT day grouping):
 * `Vandaag` / `Morgen` / formatted day (`za 14 jun`).
 *
 * Returns a stable string per calendar day so consecutive tasks on the same
 * day group under one header.
 */
export function dayGroupLabel(t: TFunction, dueAtIso: string, now: Date = new Date()): string {
  const delta = deltaDays(dueAtIso, now)
  if (delta < 0) return t('tasks:group.overdue')
  if (delta === 0) return t('tasks:group.today')
  if (delta === 1) return t('tasks:group.tomorrow')
  return dayFormatter().format(new Date(dueAtIso))
}
