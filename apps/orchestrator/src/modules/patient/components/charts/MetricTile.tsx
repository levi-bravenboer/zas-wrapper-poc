import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/style/cn'

import { collectSparkPoints, formatNumber, pickLatest, pickTrend } from './instrumentSummary'
import { Sparkline } from './Sparkline'
import type { LusciiMeasurementSeries } from './types'

export interface MetricTileProps {
  instrumentName: string | null
  series: LusciiMeasurementSeries[]
  onSelect: () => void
}

/** Compact, scannable metric: instrument name, latest value, step trend and a
 *  sparkline. The whole tile is a button that opens the detail dialog. */
export function MetricTile({ instrumentName, series, onSelect }: MetricTileProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  const latest = pickLatest(series)
  const spark = collectSparkPoints(series)
  const trend = pickTrend(spark)
  const name = instrumentName ?? t('charts.unknown_instrument')

  const TrendIcon =
    trend?.dir === 'up' ? ArrowUpRight : trend?.dir === 'down' ? ArrowDownRight : ArrowRight

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left',
        'transition-colors hover:border-primary/40 hover:bg-surface-1',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-medium text-foreground" title={name}>
          {name}
        </h3>
        {trend ? (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-foreground-muted"
            title={t('charts.trend.since_previous')}
          >
            <TrendIcon className="size-3" aria-hidden />
            {trend.dir !== 'flat' ? formatNumber(Math.abs(trend.delta)) : null}
          </span>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-3">
        <span
          className={cn(
            'min-w-0 font-semibold tracking-tight text-foreground',
            // Long text values (free-text / categorical) clamp to 2 lines at a
            // readable size; short values (numbers, Ja/Nee) stay big.
            (latest?.length ?? 0) > 14
              ? 'line-clamp-2 text-sm leading-snug'
              : 'text-2xl leading-none',
          )}
        >
          {latest ?? '—'}
        </span>
        <Sparkline points={spark} className="mb-0.5" />
      </div>
    </button>
  )
}
