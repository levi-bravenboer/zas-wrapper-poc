import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import type { ReplicaStats } from './aggregates'

/**
 * Luscii's four-box summary strip: Gemiddeld / Minimum / Maximum / Nieuwste,
 * each value suffixed with the instrument unit. Mirrors the grey rounded
 * boxes shown above each Luscii chart.
 */
export function ReplicaStatRow({ stats }: { stats: ReplicaStats }): ReactElement {
  const { t } = useTranslation('patient-profile')
  const unit = stats.unit ? ` ${stats.unit}` : ''
  const boxes: { label: string; value: string }[] = [
    { label: t('replica.stats.average'), value: `${stats.average}${unit}` },
    { label: t('replica.stats.minimum'), value: `${stats.minimum}${unit}` },
    { label: t('replica.stats.maximum'), value: `${stats.maximum}${unit}` },
    { label: t('replica.stats.latest'), value: `${stats.latest}${unit}` },
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {boxes.map((box) => (
        <div key={box.label} className="rounded-md bg-surface-2 px-3 py-2">
          <div className="text-xs text-foreground-muted">{box.label}</div>
          <div className="text-sm font-semibold">{box.value}</div>
        </div>
      ))}
    </div>
  )
}
