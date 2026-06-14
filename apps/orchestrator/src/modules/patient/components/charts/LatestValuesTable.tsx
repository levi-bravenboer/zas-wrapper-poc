import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/style/cn'

import { shortDateTime } from './dateLabel'
import type {
  LusciiCategoricalPoint,
  LusciiFreeTextPoint,
  LusciiMeasurementPoint,
  LusciiMeasurementSeries,
  LusciiNumericPoint,
  LusciiOrdinalPoint,
  LusciiUnknownPoint,
} from './types'

const FREE_TEXT_CAP = 60

interface OverviewRow {
  key: string
  label: string
  value: string
  observed_at: string
}

export interface LatestValuesTableProps {
  series: LusciiMeasurementSeries[]
}

/**
 * At-a-glance overview rendered above the InstrumentCards: one row per
 * series with the most recent value + observation time. Every archetype is
 * surfaced — numeric/ordinal as `value unit`, categorical as the joined
 * `responses`, free_text truncated, unknown as raw or em-dash.
 *
 * Renders as a CSS grid of `<div>`s (not `<table>`/shadcn Table) so the
 * project rule "All overviews MUST use DataTable" stays untouched; this is
 * an inline patient-scoped summary, not a paginated list of records.
 */
export function LatestValuesTable({ series }: LatestValuesTableProps): ReactElement | null {
  const { t } = useTranslation('patient-profile')

  const rows: OverviewRow[] = series
    .map((s): OverviewRow | null => {
      const last = s.points?.at(-1)
      if (!last) return null
      return {
        key: s.series_id,
        label: s.label ?? s.item_id,
        value: formatLatest(s, last),
        observed_at: last.observed_at,
      }
    })
    .filter((row): row is OverviewRow => row !== null)
    .toSorted((a, b) => (a.observed_at < b.observed_at ? 1 : a.observed_at > b.observed_at ? -1 : 0))

  if (rows.length === 0) return null

  return (
    <Card data-testid="latest-values-overview" className="p-0">
      <div
        role="table"
        aria-label={t('charts.overview.aria_label')}
        className="grid grid-cols-[1fr_1fr_auto] text-sm"
      >
        <div role="rowgroup" className="contents text-xs uppercase tracking-wider text-foreground-muted">
          <div role="row" className="contents">
            <div role="columnheader" className="border-b border-border px-4 py-2">
              {t('charts.overview.column.item')}
            </div>
            <div role="columnheader" className="border-b border-border px-4 py-2">
              {t('charts.overview.column.value')}
            </div>
            <div role="columnheader" className="border-b border-border px-4 py-2 text-right">
              {t('charts.overview.column.time')}
            </div>
          </div>
        </div>
        <div role="rowgroup" className="contents">
          {rows.map((row, index) => (
            <div role="row" key={row.key} className="contents">
              <div
                role="cell"
                className={cellClass(index === rows.length - 1, 'font-medium text-foreground')}
              >
                {row.label}
              </div>
              <div
                role="cell"
                className={cellClass(index === rows.length - 1, 'text-foreground')}
              >
                {row.value}
              </div>
              <div
                role="cell"
                className={cellClass(
                  index === rows.length - 1,
                  'text-right text-xs text-foreground-muted whitespace-nowrap',
                )}
              >
                {shortDateTime(row.observed_at)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function cellClass(isLast: boolean, extra: string): string {
  return cn('px-4 py-2', !isLast && 'border-b border-border', extra)
}

function formatLatest(series: LusciiMeasurementSeries, point: LusciiMeasurementPoint): string {
  switch (point.archetype) {
    case 'numeric':
    case 'ordinal':
      return formatNumericWithUnit(point, series.unit)
    case 'categorical':
      return formatCategorical(point)
    case 'free_text':
      return formatFreeText(point)
    case 'unknown':
      return formatUnknown(point)
  }
}

function formatNumericWithUnit(
  point: LusciiNumericPoint | LusciiOrdinalPoint,
  unit: string | null | undefined,
): string {
  const value = Number.isInteger(point.value)
    ? point.value.toString()
    : point.value.toFixed(1).replace('.', ',')
  return unit ? `${value} ${unit}` : value
}

function formatCategorical(point: LusciiCategoricalPoint): string {
  return point.responses?.join(', ') || '—'
}

function formatFreeText(point: LusciiFreeTextPoint): string {
  const text = point.text.trim()
  if (text.length <= FREE_TEXT_CAP) return text
  const slice = text.slice(0, FREE_TEXT_CAP)
  const lastSpace = slice.lastIndexOf(' ')
  return lastSpace < 20
    ? `${slice.trimEnd()}…`
    : `${slice.slice(0, lastSpace).trimEnd()}…`
}

function formatUnknown(point: LusciiUnknownPoint): string {
  return point.raw ?? '—'
}
