import { AlertCircle, Inbox } from 'lucide-react'
import { type ReactElement, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { type LusciiWindowDays, useLusciiData } from '../../hooks'
import type { LusciiMeasurementSeries } from '../charts/types'
import { LusciiPanel } from '../LusciiPanel'

import { ReplicaCard } from './ReplicaCard'
import { ReplicaFilterBar } from './ReplicaFilterBar'

const NOT_CONFIGURED_CODE = 'unavailable.luscii.not_configured'
const POLL_MS = 5000

// Dev-editable card order. Cards whose instrument name matches an entry render
// in this order; anything not listed is appended in the order the API returns
// it. Reorder by editing this array — there is no in-UI ordering control.
const INSTRUMENT_ORDER: string[] = []

export interface MeasurementReplicaProps {
  patientId: string
}

/**
 * Luscii-faithful replica of the patient Metingen screen. Renders the same
 * stacked measurement cards Luscii shows, recoloured to the orchestrator
 * green, behind the `VITE_LUSCII_METINGEN_REPLICA` flag. Polls every 5s so
 * new measurements surface live.
 */
export function MeasurementReplica({ patientId }: MeasurementReplicaProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  const [days, setDays] = useState<LusciiWindowDays>(90)

  const dataQuery = useLusciiData(patientId, { days, pollMs: POLL_MS })
  const data = dataQuery.data
  const isNotConfigured = !!dataQuery.error && hasErrorCode(dataQuery.error, NOT_CONFIGURED_CODE)

  if (dataQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  // Unconfigured + not-linked keep the existing link/unlink UX.
  if (isNotConfigured || data?.state === 'not_linked') {
    return <LusciiPanel patientId={patientId} />
  }

  const showError = dataQuery.isError && !isNotConfigured
  const groups = orderGroups(groupByInstrument(data?.series ?? []))

  return (
    <div className="flex flex-col gap-4">
      <ReplicaFilterBar active={days} onChange={setDays} />
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
        <EmptyState icon={Inbox} title={t('charts.empty.title')} body={t('charts.empty.body')} />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <ReplicaCard
              key={group.instrument_id}
              title={group.instrument_name ?? t('charts.programme.fallback')}
              series={group.series}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface InstrumentGroup {
  instrument_id: string
  instrument_name: string | null
  series: LusciiMeasurementSeries[]
}

function groupByInstrument(series: LusciiMeasurementSeries[]): InstrumentGroup[] {
  const map = new Map<string, InstrumentGroup>()
  for (const s of series) {
    if (!s.points || s.points.length === 0) continue
    const existing = map.get(s.instrument_id)
    if (existing) {
      existing.series.push(s)
      if (!existing.instrument_name && s.instrument_name)
        existing.instrument_name = s.instrument_name
    } else {
      map.set(s.instrument_id, {
        instrument_id: s.instrument_id,
        instrument_name: s.instrument_name ?? null,
        series: [s],
      })
    }
  }
  return [...map.values()]
}

/** Apply the static dev-defined order; unlisted instruments keep API order. */
function orderGroups(groups: InstrumentGroup[]): InstrumentGroup[] {
  if (INSTRUMENT_ORDER.length === 0) return groups
  const rank = (name: string | null): number => {
    const idx = name ? INSTRUMENT_ORDER.indexOf(name) : -1
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
  }
  return groups
    .map((group, index) => ({ group, index }))
    .toSorted((a, b) => {
      const ra = rank(a.group.instrument_name)
      const rb = rank(b.group.instrument_name)
      return ra !== rb ? ra - rb : a.index - b.index
    })
    .map((entry) => entry.group)
}

function hasErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = (error as { code?: unknown }).code
  return typeof candidate === 'string' && candidate === code
}
