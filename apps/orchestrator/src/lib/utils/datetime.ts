import { intlLocale } from '@/lib/i18n'

export function formatTime(value: string | number | Date, locale?: string): string {
  return new Date(value).toLocaleTimeString(intlLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(value: string | number | Date, locale?: string): string {
  return new Date(value).toLocaleDateString(intlLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const EM_DASH = '—'

export function formatDateOrDash(value: string | null | undefined, locale: string): string {
  if (!value) return EM_DASH
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(intlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTimeOrDash(value: string | null | undefined, locale: string): string {
  if (!value) return EM_DASH
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString(intlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
