import { type ReactElement } from 'react'

import { Badge } from '@/components/ui/badge'

import { shortDateTime } from './dateLabel'
import type { CategoricalSeries } from './types'

export interface ChipStreamTimelineProps {
  series: CategoricalSeries
}

/**
 * Horizontal stream of dated chips for a categorical (questionnaire) series.
 * Newest entries first. No aggregation, no distribution chart — chronology
 * is the signal. Empty `responses[]` is rendered as a muted dash so the
 * date line still anchors the entry.
 */
export function ChipStreamTimeline({ series }: ChipStreamTimelineProps): ReactElement {
  const ordered = series.points.toSorted((a, b) =>
    a.observed_at < b.observed_at ? 1 : a.observed_at > b.observed_at ? -1 : 0,
  )

  return (
    <ol className="flex flex-col gap-3" data-testid="chip-stream">
      {ordered.map((point, index) => (
        <li
          key={`${point.observed_at}-${index}`}
          className="flex flex-wrap items-start gap-3 text-sm"
        >
          <time className="w-28 shrink-0 font-mono text-xs text-foreground-muted">
            {shortDateTime(point.observed_at)}
          </time>
          <div className="flex flex-wrap gap-2">
            {point.responses?.length ? (
              point.responses.map((response, i) => (
                <Badge key={`${response}-${i}`} variant="soft">
                  {response}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-foreground-muted">—</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
