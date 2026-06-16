import { useViewport } from '@xyflow/react'
import { useRef, type CSSProperties, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { LANE_ROW_MIN_HEIGHT, laneAccent } from '../../canvasLayout'
import { ZOOM_SAFE_DIVISOR_FLOOR } from '../../constants/canvas'
import type { PathwayLane } from '../../types'

type Props = {
  lane: PathwayLane
  topY: number
  height: number
  width: number
  isEmpty: boolean
  onResize: (height: number) => void
}

export function LaneRow({ lane, topY, height, width, isEmpty, onResize }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const accent = laneAccent(lane)
  const { zoom } = useViewport()
  const dragRef = useRef<{ startH: number; startY: number } | null>(null)

  // Keep lane backgrounds beneath blocks. xyflow nodes render in
  // `.react-flow__nodes` (default z-index 0); ViewportPortal contents share
  // the same stacking context but are emitted later in the DOM, so without
  // an explicit negative z they paint on top of unselected blocks.
  const style = {
    top: topY,
    left: 0,
    width,
    height,
    zIndex: -1,
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
    const dy = (event.clientY - drag.startY) / Math.max(zoom, ZOOM_SAFE_DIVISOR_FLOOR)
    onResize(Math.round(Math.max(LANE_ROW_MIN_HEIGHT, drag.startH + dy)))
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
        aria-label={t('canvas.resizeLane', { label: lane.label })}
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
