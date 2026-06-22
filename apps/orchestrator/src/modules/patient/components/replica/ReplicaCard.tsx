import { MoreVertical } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui/card'

import { InstrumentCharts } from '../charts/InstrumentCharts'
import type { LusciiMeasurementSeries } from '../charts/types'

import { computeStats } from './aggregates'
import { ReplicaStatRow } from './ReplicaStatRow'

export interface ReplicaCardProps {
  title: string
  series: LusciiMeasurementSeries[]
}

/**
 * One full-width Luscii-style measurement card: underlined title, a visual
 * `⋮` affordance (no actions in v1), the Gemiddeld/Min/Max/Nieuwste stat row
 * when numeric points exist, and the chart body.
 */
export function ReplicaCard({ title, series }: ReplicaCardProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  const stats = computeStats(series)
  return (
    <Card className="w-full">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-primary underline decoration-1 underline-offset-4">
            {title}
          </h3>
          <button
            type="button"
            disabled
            aria-label={t('replica.card.menu')}
            className="text-foreground-muted"
          >
            <MoreVertical className="size-5" aria-hidden />
          </button>
        </div>
        {stats ? <ReplicaStatRow stats={stats} /> : null}
        <InstrumentCharts series={series} />
      </CardContent>
    </Card>
  )
}
