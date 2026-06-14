import { type ReactElement, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/style/cn'

import { LineChart } from './LineChart'
import { renderChartForSeries } from './registry'
import { Sparkline } from './Sparkline'
import type {
  LusciiMeasurementSeries,
  NumericSeries,
  LusciiNumericPoint,
  LusciiOrdinalPoint,
} from './types'

export interface InstrumentCardProps {
  instrumentId: string
  instrumentName: string | null
  series: LusciiMeasurementSeries[]
}

/**
 * One card per Luscii instrument. The card header shows the instrument
 * name, the latest value across this instrument's series, and a sparkline
 * (when there are ≥ 2 numeric/ordinal points combined). The card body
 * (collapsed by default) renders one chart per series — except numeric-only
 * multi-item instruments, which compose into a single multi-line chart
 * (D-MULTI-SERIES).
 */
export function InstrumentCard({
  instrumentId: _instrumentId,
  instrumentName,
  series,
}: InstrumentCardProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  const [expanded, setExpanded] = useState(false)

  const latest = pickLatest(series)
  const sparkPoints = collectSparkPoints(series)
  const allNumeric = series.every((s) => s.archetype === 'numeric')

  const headerLabel = instrumentName ?? t('charts.unknown_instrument')

  return (
    <Card data-instrument-id={_instrumentId} className="overflow-hidden">
      <CardHeader className="p-0">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className={cn(
            'flex w-full items-center justify-between gap-4 px-4 py-3 text-left',
            'hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-foreground">{headerLabel}</h3>
              {latest ? (
                <p className="text-xs text-foreground-muted">
                  <span className="sr-only">{t('charts.last_value')}: </span>
                  {latest}
                </p>
              ) : null}
            </div>
            <Sparkline points={sparkPoints} className="ml-auto" />
          </div>
          <span aria-hidden className="text-xs text-foreground-muted">
            {expanded ? '▾' : '▸'}
          </span>
        </button>
      </CardHeader>

      {expanded ? (
        <CardContent className="border-t border-border px-4 py-4">
          {allNumeric && series.length >= 1 ? (
            <LineChart series={series as NumericSeries[]} />
          ) : (
            <div className="flex flex-col gap-4">
              {series.map((s) => (
                <div key={s.series_id} className="flex flex-col gap-2">
                  {series.length > 1 && s.label ? (
                    <h4 className="text-xs font-medium text-foreground-muted">{s.label}</h4>
                  ) : null}
                  {renderChartForSeries(s)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      ) : null}
    </Card>
  )
}

function pickLatest(series: LusciiMeasurementSeries[]): string | null {
  let latestAt = ''
  let latestText = ''
  for (const s of series) {
    const last = s.points?.at(-1)
    if (!last) continue
    if (last.observed_at > latestAt) {
      latestAt = last.observed_at
      latestText = formatPoint(s, last)
    }
  }
  return latestText || null
}

function formatPoint(
  s: LusciiMeasurementSeries,
  point: NonNullable<LusciiMeasurementSeries['points']>[number],
): string {
  switch (point.archetype) {
    case 'numeric':
    case 'ordinal': {
      const unit = s.unit ? ` ${s.unit}` : ''
      return `${formatNumber(point.value)}${unit}`
    }
    case 'categorical':
      return point.responses?.join(', ') ?? '—'
    case 'free_text':
      return point.text
    case 'unknown':
      return point.raw ?? '—'
    default:
      return '—'
  }
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1).replace('.', ',')
}

function collectSparkPoints(
  series: LusciiMeasurementSeries[],
): (LusciiNumericPoint | LusciiOrdinalPoint)[] {
  const points: (LusciiNumericPoint | LusciiOrdinalPoint)[] = []
  for (const s of series) {
    if (s.archetype !== 'numeric' && s.archetype !== 'ordinal') continue
    for (const point of s.points ?? []) {
      if (point.archetype === 'numeric' || point.archetype === 'ordinal') {
        points.push(point)
      }
    }
  }
  return points.toSorted((a, b) =>
    a.observed_at < b.observed_at ? -1 : a.observed_at > b.observed_at ? 1 : 0,
  )
}
