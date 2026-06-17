import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { formatDateOrDash } from '@/lib/utils/datetime'

import type { Enrollment } from '../types'

export interface PathwaySummaryHeaderProps {
  state: Enrollment['state']
  anchorDate: string
  phaseName: string | null
  done: number
  total: number
}

export function PathwaySummaryHeader({
  state,
  anchorDate,
  phaseName,
  done,
  total,
}: PathwaySummaryHeaderProps): ReactElement {
  const { t, i18n } = useTranslation('patient-pathway')
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge variant="soft">{t(`card.state.${state}`)}</Badge>
        <span className="text-sm text-muted-foreground">
          {t('card.anchor')}: {formatDateOrDash(anchorDate, i18n.language)}
        </span>
        {phaseName ? (
          <span className="text-sm text-muted-foreground">
            · {t('summary.phase', { phase: phaseName })}
          </span>
        ) : null}
        <span className="ml-auto text-xs font-medium text-muted-foreground">
          {t('summary.progress', { done, total })}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
