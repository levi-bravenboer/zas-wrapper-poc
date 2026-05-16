import { type CSSProperties, type ReactElement } from 'react'

import { phaseTint } from '../../canvasLayout'
import type { PathwayPhase } from '../../types'

type Props = {
  phase: PathwayPhase
  index: number
  blockCount: number
  xStart: number
  width: number
}

export function PhaseColumn({ phase, index, blockCount, xStart, width }: Props): ReactElement {
  const tint = phaseTint(index)
  const style = {
    left: xStart,
    width,
    '--ph-soft': tint.soft,
    '--ph-ink': tint.ink,
  } as CSSProperties
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 bottom-0 border-r border-dashed border-black/5"
      style={style}
    >
      <div
        className="absolute inset-y-0 inset-x-0"
        style={{ background: 'var(--ph-soft)', opacity: 0.28 }}
      />
      <div className="absolute top-3.5 left-3.5 inline-flex h-[26px] items-center gap-1.5 rounded-full border bg-white/55 px-2.5 py-0 shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md">
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold tabular-nums"
          style={{ background: 'var(--ph-soft)', color: 'var(--ph-ink)' }}
        >
          {index + 1}
        </span>
        <span className="text-[11.5px] font-semibold tracking-tight text-foreground">
          {phase.label}
        </span>
        <span className="rounded-full bg-black/5 px-1.5 py-px text-[10.5px] text-muted-foreground tabular-nums">
          {blockCount}
        </span>
      </div>
    </div>
  )
}
