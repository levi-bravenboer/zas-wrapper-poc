import { type ReactElement, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AlertDot } from './AlertDot'
import { shortDateTime } from './dateLabel'
import type { FreeTextSeries } from './types'

const TRUNCATE_AT = 140

export interface FreeTextLogProps {
  series: FreeTextSeries
}

/**
 * Dated list of free-text answers. Each entry truncates at ~140 chars with
 * a `meer tonen` ↔ `minder tonen` toggle per D-FREETEXT-TRUNCATE. Truncation
 * respects word boundaries when possible.
 */
export function FreeTextLog({ series }: FreeTextLogProps): ReactElement {
  const ordered = series.points.toSorted((a, b) =>
    a.observed_at < b.observed_at ? 1 : a.observed_at > b.observed_at ? -1 : 0,
  )

  return (
    <ol className="flex flex-col gap-3" data-testid="free-text-log">
      {ordered.map((point, index) => (
        <FreeTextEntry
          key={`${point.observed_at}-${index}`}
          text={point.text}
          observedAt={point.observed_at}
          alertFlag={point.alert_flag}
        />
      ))}
    </ol>
  )
}

interface FreeTextEntryProps {
  text: string
  observedAt: string
  alertFlag: string | null | undefined
}

function FreeTextEntry({ text, observedAt, alertFlag }: FreeTextEntryProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  const [expanded, setExpanded] = useState(false)

  const shouldTruncate = text.length > TRUNCATE_AT
  const visible = expanded || !shouldTruncate ? text : truncate(text, TRUNCATE_AT)

  return (
    <li className="flex flex-wrap items-start gap-3 text-sm">
      <AlertDot flag={alertFlag} />
      <time className="w-28 shrink-0 font-mono text-xs text-foreground-muted">
        {shortDateTime(observedAt)}
      </time>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="whitespace-pre-wrap break-words text-foreground">{visible}</p>
        {shouldTruncate ? (
          <button
            type="button"
            className="self-start text-xs text-primary hover:underline"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? t('charts.free_text.show_less') : t('charts.free_text.show_more')}
          </button>
        ) : null}
      </div>
    </li>
  )
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const slice = text.slice(0, max)
  const lastSpace = slice.lastIndexOf(' ')
  // Fall back to a hard slice when no whitespace exists in the first `max`
  // chars (very long unbroken token — rare in clinical questionnaires).
  if (lastSpace < 40) return `${slice.trimEnd()}…`
  return `${slice.slice(0, lastSpace).trimEnd()}…`
}
