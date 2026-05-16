import { type CSSProperties, type ReactElement } from 'react'

import { laneAccent } from '../../canvasLayout'
import type { PathwayLane } from '../../types'

type Props = {
  lane: PathwayLane
  topY: number
  height: number
  isEmpty: boolean
}

export function LaneRow({ lane, topY, height, isEmpty }: Props): ReactElement {
  const accent = laneAccent(lane)
  const style = {
    top: topY,
    height,
    '--lane-accent': accent,
  } as CSSProperties
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-0 left-0 border-t"
      style={{
        ...style,
        background: `color-mix(in srgb, ${accent} 4%, transparent)`,
        borderTopColor: `color-mix(in srgb, ${accent} 12%, var(--hairline))`,
        outline: isEmpty ? `2px dashed color-mix(in srgb, ${accent} 30%, transparent)` : undefined,
        outlineOffset: '-12px',
      }}
    />
  )
}
