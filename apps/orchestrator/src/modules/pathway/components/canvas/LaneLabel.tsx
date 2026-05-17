import { type CSSProperties, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { LaneKindIcon } from '../../blockCatalogue'
import { laneAccent } from '../../canvasLayout'
import type { PathwayLane } from '../../types'

type Props = {
  lane: PathwayLane
  topY: number
  blockCount: number
  i18nLaneName?: string
}

export function LaneLabel({ lane, topY, blockCount, i18nLaneName }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const accent = laneAccent(lane)
  const style = {
    top: topY + 8,
    left: 12,
    '--lane-accent': accent,
  } as CSSProperties
  return (
    <div
      role="group"
      aria-label={t('canvas.laneLabel', { label: i18nLaneName ?? lane.label, count: blockCount })}
      className="pointer-events-auto absolute inline-flex h-7 items-center gap-2 rounded-full border bg-white/70 px-3 py-0 shadow-xs backdrop-blur-sm"
      style={{
        ...style,
        borderColor: `color-mix(in srgb, ${accent} 24%, var(--hairline))`,
        opacity: blockCount === 0 ? 0.6 : 1,
      }}
    >
      <span
        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-sm"
        style={{
          background: `color-mix(in srgb, ${accent} 14%, transparent)`,
          color: accent,
        }}
      >
        <LaneKindIcon code={lane.lane_kind_code} className="size-[13px]" strokeWidth={1.8} />
      </span>
      <span className="text-[12px] font-semibold text-foreground">
        {i18nLaneName ?? lane.label}
      </span>
      <span className="text-[11px] tabular-nums text-muted-foreground">{blockCount}</span>
    </div>
  )
}
