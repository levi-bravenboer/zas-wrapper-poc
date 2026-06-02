import { format as dateFnsFormat } from 'date-fns'
import { nl } from 'date-fns/locale'

export function formatDate(
  value: Date | number,
  pattern: string = 'PPP'
): string {
  return dateFnsFormat(value, pattern, { locale: nl })
}
