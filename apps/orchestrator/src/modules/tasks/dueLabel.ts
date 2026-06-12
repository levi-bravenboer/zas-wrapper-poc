import type { TFunction } from 'i18next'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

const timeFormatter = new Intl.DateTimeFormat('nl-BE', {
  hour: '2-digit',
  minute: '2-digit',
})

function localDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Localised "due-at" copy for a task row.
 *
 * Today  → "vandaag {time}"
 * Tomorrow → "morgen {time}"
 * 2-3 days out → "over {n} dagen"
 *
 * v1 task list window is ≤3 days, so we don't render past-due copy here.
 */
export function dueLabel(t: TFunction, dueAtIso: string, now: Date = new Date()): string {
  const due = new Date(dueAtIso)
  const todayMidnight = localDateOnly(now)
  const dueMidnight = localDateOnly(due)
  const deltaDays = Math.round((dueMidnight.getTime() - todayMidnight.getTime()) / ONE_DAY_MS)

  if (deltaDays <= 0) {
    return t('tasks:due.today', { time: timeFormatter.format(due) })
  }
  if (deltaDays === 1) {
    return t('tasks:due.tomorrow', { time: timeFormatter.format(due) })
  }
  return t('tasks:due.in_days', { count: deltaDays })
}
