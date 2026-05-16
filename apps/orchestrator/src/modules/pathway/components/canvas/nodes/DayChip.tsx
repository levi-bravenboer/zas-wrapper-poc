import { type ReactElement } from 'react'

import { formatTimingValue } from '../../../dayChip'
import type { PathwayTimingValue } from '../../../types'

type Props = {
  value: PathwayTimingValue | null | undefined
}

export function DayChip({ value }: Props): ReactElement | null {
  const text = formatTimingValue(value)
  if (!text) return null
  return (
    <span
      className="inline-flex h-[18px] items-center rounded-full border px-[7px] text-[10.5px] font-semibold tabular-nums"
      style={{
        background: 'color-mix(in srgb, var(--lane-accent) 8%, var(--card))',
        borderColor: 'color-mix(in srgb, var(--lane-accent) 18%, transparent)',
        color: 'var(--lane-accent)',
      }}
    >
      {text}
    </span>
  )
}
