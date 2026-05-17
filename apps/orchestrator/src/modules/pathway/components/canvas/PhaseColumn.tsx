import { useViewport } from '@xyflow/react'
import { useRef, type CSSProperties, type ReactElement } from 'react'

import { PHASE_COL_MIN_WIDTH, phaseTint } from '../../canvasLayout'
import { ZOOM_SAFE_DIVISOR_FLOOR } from '../../constants/canvas'
import type { PathwayPhase } from '../../types'

type Props = {
  phase: PathwayPhase
  index: number
  blockCount: number
  xStart: number
  width: number
  height: number
  onResize: (width: number) => void
}

export function PhaseColumn({
  phase,
  index,
  blockCount,
  xStart,
  width,
  height,
  onResize,
}: Props): ReactElement {
  const tint = phaseTint(index)
  const { zoom } = useViewport()
  const dragRef = useRef<{ startW: number; startX: number } | null>(null)

  const style = {
    left: xStart,
    top: 0,
    width,
    height,
    '--ph-soft': tint.soft,
    '--ph-ink': tint.ink,
  } as CSSProperties

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { startW: width, startX: event.clientX }
  }
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current
    if (!drag) return
    const dx = (event.clientX - drag.startX) / Math.max(zoom, ZOOM_SAFE_DIVISOR_FLOOR)
    onResize(Math.max(PHASE_COL_MIN_WIDTH, drag.startW + dx))
  }
  function onPointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute border-r border-dashed border-black/5"
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
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Verbreed fase ${phase.label}`}
        className="pointer-events-auto absolute top-0 bottom-0 right-0 w-2 cursor-col-resize hover:bg-black/[0.06] active:bg-black/[0.1]"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  )
}
