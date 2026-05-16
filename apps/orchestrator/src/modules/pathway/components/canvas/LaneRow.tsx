import { useViewport } from '@xyflow/react'
import { useRef, type CSSProperties, type ReactElement } from 'react'

import { LANE_ROW_MIN_HEIGHT, laneAccent } from '../../canvasLayout'
import type { PathwayLane } from '../../types'

type Props = {
  lane: PathwayLane
  topY: number
  height: number
  width: number
  isEmpty: boolean
  onResize: (height: number) => void
}

export function LaneRow({
  lane,
  topY,
  height,
  width,
  isEmpty,
  onResize,
}: Props): ReactElement {
  const accent = laneAccent(lane)
  const { zoom } = useViewport()
  const dragRef = useRef<{ startH: number; startY: number } | null>(null)

  const style = {
    top: topY,
    left: 0,
    width,
    height,
    '--lane-accent': accent,
  } as CSSProperties

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { startH: height, startY: event.clientY }
  }
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current
    if (!drag) return
    const dy = (event.clientY - drag.startY) / Math.max(zoom, 0.05)
    onResize(Math.max(LANE_ROW_MIN_HEIGHT, drag.startH + dy))
  }
  function onPointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute border-t"
      style={{
        ...style,
        background: `color-mix(in srgb, ${accent} 4%, transparent)`,
        borderTopColor: `color-mix(in srgb, ${accent} 12%, var(--hairline))`,
        outline: isEmpty ? `2px dashed color-mix(in srgb, ${accent} 30%, transparent)` : undefined,
        outlineOffset: '-12px',
      }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={`Vergroot baan ${lane.label}`}
        className="pointer-events-auto absolute right-0 bottom-0 left-0 h-2 cursor-row-resize hover:bg-black/[0.06] active:bg-black/[0.1]"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  )
}
