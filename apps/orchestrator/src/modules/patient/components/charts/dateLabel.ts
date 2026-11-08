import { intlLocale } from '@/lib/i18n'

// Browser-local timezone, locale follows the active UI language.

const dayMonthFormatter = (): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(intlLocale(), {
    day: 'numeric',
    month: 'short',
  })

const dayMonthYearFormatter = (): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(intlLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

const dayMonthTimeFormatter = (): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(intlLocale(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

/** `14 jun` — used for axis ticks where the year is implicit. */
export function shortDate(iso: string): string {
  return dayMonthFormatter().format(new Date(iso))
}

/** `14 jun 2026` — used when the window may span a year boundary. */
export function shortDateWithYear(iso: string): string {
  return dayMonthYearFormatter().format(new Date(iso))
}

/** `14 jun 08:24` — used for tooltips + sparse-series labels. */
export function shortDateTime(iso: string): string {
  return dayMonthTimeFormatter().format(new Date(iso))
}
