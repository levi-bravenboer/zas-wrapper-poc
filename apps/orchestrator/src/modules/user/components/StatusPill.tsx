import { CheckCircle2, XCircle } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

export interface StatusPillProps {
  active: boolean
}

export function StatusPill({ active }: StatusPillProps): ReactElement {
  const { t } = useTranslation('users')
  if (active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900">
        <CheckCircle2 aria-hidden className="h-3 w-3" />
        {t('status.active')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border/60">
      <XCircle aria-hidden className="h-3 w-3" />
      {t('status.inactive')}
    </span>
  )
}
