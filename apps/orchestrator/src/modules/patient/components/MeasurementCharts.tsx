import { Inbox, AlertCircle } from 'lucide-react'
import { type ReactElement, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/style/cn'

import { useLusciiData, type LusciiWindowDays } from '../hooks'

import {
  InstrumentDetailDialog,
  type InstrumentDetail,
} from './charts/InstrumentDetailDialog'
import { MetricTile } from './charts/MetricTile'
import type { LusciiMeasurementSeries } from './charts/types'
import { LusciiPanel } from './LusciiPanel'

const WINDOW_OPTIONS: LusciiWindowDays[] = [7, 30, 90, 365]
const NOT_CONFIGURED_CODE = 'unavailable.luscii.not_configured'

export interface MeasurementChartsProps {
  patientId: string
}

/**
 * Primary `Metingen` tab content. Instrument-grouped charts on top, the
 * existing `<LusciiPanel>` (programme/protocol header + planned-actions
 * timeline + link/unlink UX) tucked into a collapsed disclosure at the
 * bottom. The data layer is a single live-proxy call per window per
 * patient; the chart layer iterates the typed `series[]` block.
 */
export function MeasurementCharts({ patientId }: MeasurementChartsProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  const [days, setDays] = useState<LusciiWindowDays>(30)
  const [plannedOpen, setPlannedOpen] = useState(false)
  const [detail, setDetail] = useState<InstrumentDetail | null>(null)

  const dataQuery = useLusciiData(patientId, { days })
  const data = dataQuery.data
  const isNotConfigured = !!dataQuery.error && hasErrorCode(dataQuery.error, NOT_CONFIGURED_CODE)

  if (dataQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  // Unconfigured + not-linked stay rendered by the existing `<LusciiPanel>`
  // so the link UX stays where it was.
  if (isNotConfigured || data?.state === 'not_linked') {
    return <LusciiPanel patientId={patientId} />
  }

  // Generic fetch errors stay PANEL-SCOPED per D-STATES — the rest of the
  // patient profile keeps rendering. The window selector stays visible so
  // the caregiver can retry with a different range without leaving the tab.
  const programmeName = data?.program?.name ?? t('charts.programme.fallback')
  const showError = dataQuery.isError && !isNotConfigured
  const series = data?.series ?? []
  const groups = groupByInstrument(series)
  const plannedCount =
    (data?.planned_actions?.length ?? 0) + (data?.unmatched_measurements?.length ?? 0)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs uppercase tracking-wider text-foreground-muted">
            {t('charts.programme.label')}
          </span>
          <span className="font-medium">{programmeName}</span>
        </div>
        <WindowSelector active={days} onChange={setDays} />
      </header>

      {showError ? (
        <EmptyState
          icon={AlertCircle}
          title={t('charts.error.title')}
          body={t('charts.error.body')}
          action={
            <Button variant="outline" onClick={() => void dataQuery.refetch()}>
              {t('charts.error.retry')}
            </Button>
          }
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t('charts.empty.title')}
          body={t('charts.empty.body')}
          {...(days < 90
            ? {
                action: (
                  <Button variant="outline" onClick={() => setDays(90)}>
                    {t('charts.empty.widen_cta')}
                  </Button>
                ),
              }
            : {})}
        />
      ) : (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <MetricTile
              key={group.instrument_id}
              instrumentName={group.instrument_name}
              series={group.series}
              onSelect={() =>
                setDetail({
                  instrumentId: group.instrument_id,
                  instrumentName: group.instrument_name,
                  series: group.series,
                })
              }
            />
          ))}
        </section>
      )}

      {!showError && plannedCount > 0 ? (
        <Card>
          <button
            type="button"
            onClick={() => setPlannedOpen((prev) => !prev)}
            aria-expanded={plannedOpen}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-2"
          >
            <span className="text-sm font-medium">
              {plannedOpen
                ? t('charts.planned_actions.toggle_hide', { count: plannedCount })
                : t('charts.planned_actions.toggle_show', { count: plannedCount })}
            </span>
            <span aria-hidden className="text-xs text-foreground-muted">
              {plannedOpen ? '▾' : '▸'}
            </span>
          </button>
          {plannedOpen ? (
            <CardContent className="border-t border-border px-4 py-4">
              <LusciiPanel patientId={patientId} />
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      <InstrumentDetailDialog detail={detail} onClose={() => setDetail(null)} />
    </div>
  )
}

interface InstrumentGroup {
  instrument_id: string
  instrument_name: string | null
  series: LusciiMeasurementSeries[]
  /** Most-recent point timestamp across this instrument's series — for sort. */
  freshness: string
}

function groupByInstrument(series: LusciiMeasurementSeries[]): InstrumentGroup[] {
  const map = new Map<string, InstrumentGroup>()
  for (const s of series) {
    const last = s.points?.at(-1)
    if (!last) continue
    const existing = map.get(s.instrument_id)
    if (existing) {
      existing.series.push(s)
      if (last.observed_at > existing.freshness) existing.freshness = last.observed_at
      if (!existing.instrument_name && s.instrument_name) {
        existing.instrument_name = s.instrument_name
      }
    } else {
      map.set(s.instrument_id, {
        instrument_id: s.instrument_id,
        instrument_name: s.instrument_name ?? null,
        series: [s],
        freshness: last.observed_at,
      })
    }
  }
  return [...map.values()].toSorted((a, b) =>
    a.freshness < b.freshness ? 1 : a.freshness > b.freshness ? -1 : 0,
  )
}

interface WindowSelectorProps {
  active: LusciiWindowDays
  onChange: (next: LusciiWindowDays) => void
}

function WindowSelector({ active, onChange }: WindowSelectorProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  return (
    <div role="group" aria-label={t('charts.window.label')} className="flex items-center gap-2">
      <span className="text-xs text-foreground-muted">{t('charts.window.label')}</span>
      {WINDOW_OPTIONS.map((option) => {
        const isActive = option === active
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={isActive}
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
              isActive
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-transparent bg-primary-soft text-primary hover:opacity-80',
            )}
          >
            {t(`charts.window.${option}d` as const)}
          </button>
        )
      })}
    </div>
  )
}

function hasErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = (error as { code?: unknown }).code
  return typeof candidate === 'string' && candidate === code
}
