import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { RUNTIME_STATE_COLOR } from './runtimeState'

export function RuntimeLegend(): ReactElement {
  const { t } = useTranslation('patient-pathway')
  const items = [
    { key: 'finished', color: RUNTIME_STATE_COLOR.finished, label: t('timeline.state.finished') },
    { key: 'active', color: RUNTIME_STATE_COLOR.active, label: t('timeline.state.next') },
    { key: 'upcoming', color: RUNTIME_STATE_COLOR.upcoming, label: t('timeline.state.upcoming') },
  ]
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}
