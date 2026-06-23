import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { AlertDot } from './AlertDot'
import { shortDateTime } from './dateLabel'
import type { UnknownSeries } from './types'

export interface UnknownLogProps {
  series: UnknownSeries
}

/**
 * Fallback renderer for points the classifier cannot type (e.g. NYHA klasse
 * roman numerals in v1, file uploads, unparseable values). Dated list with
 * a muted "Onbekend formaat" annotation so the caregiver knows there's data
 * but the system did not chart it.
 */
export function UnknownLog({ series }: UnknownLogProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  const ordered = series.points.toSorted((a, b) =>
    a.observed_at < b.observed_at ? 1 : a.observed_at > b.observed_at ? -1 : 0,
  )

  return (
    <ol className="flex flex-col gap-3" data-testid="unknown-log">
      {ordered.map((point, index) => (
        <li
          key={`${point.observed_at}-${index}`}
          className="flex flex-wrap items-start gap-3 text-sm"
        >
          <AlertDot flag={point.alert_flag} />
          <time className="w-28 shrink-0 font-mono text-xs text-foreground-muted">
            {shortDateTime(point.observed_at)}
          </time>
          <div className="flex min-w-0 flex-col">
            <span className="font-mono">{point.raw ?? '—'}</span>
            <span className="text-xs text-foreground-muted">{t('charts.unknown_format')}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}
