import { useViewport } from '@xyflow/react'
import { useRef, type CSSProperties, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { LANE_ROW_MIN_HEIGHT, laneAccent } from '../../canvasLayout'
import { ZOOM_SAFE_DIVISOR_FLOOR } from '../../constants/canvas'
import type { PathwayLane } from '../../types'

export type LaneDropState = 'valid' | 'invalid' | 'idle'

type Props = {
  lane: PathwayLane
  topY: number
  height: number
  width: number
  isEmpty: boolean
  dropState?: LaneDropState
  onResize: (height: number) => void
}

export function LaneRow({
  lane,
  topY,
  height,
  width,
  isEmpty,
  dropState = 'idle',
  onResize,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
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
    const dy = (event.clientY - drag.startY) / Math.max(zoom, ZOOM_SAFE_DIVISOR_FLOOR)
    onResize(Math.max(LANE_ROW_MIN_HEIGHT, drag.startH + dy))
  }
  function onPointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const isValid = dropState === 'valid'
  const isInvalid = dropState === 'invalid'

  const background = isValid
    ? `color-mix(in srgb, ${accent} 6%, transparent)`
    : `color-mix(in srgb, ${accent} 4%, transparent)`
  const borderTopColor = isValid
    ? `color-mix(in srgb, ${accent} 60%, var(--hairline))`
    : `color-mix(in srgb, ${accent} 12%, var(--hairline))`
  const outline = isValid
    ? `2px solid color-mix(in srgb, ${accent} 70%, transparent)`
    : isEmpty
      ? `2px dashed color-mix(in srgb, ${accent} 30%, transparent)`
      : undefined
  const stripeImage = isInvalid
    ? 'repeating-linear-gradient(45deg, color-mix(in srgb, currentColor 8%, transparent) 0 6px, transparent 6px 12px)'
    : undefined

  return (
    <div
      aria-hidden="true"
      data-dropstate={dropState}
      className="pointer-events-none absolute border-t transition-[opacity,outline-color,background-color] duration-100"
      style={{
        ...style,
        background,
        borderTopColor,
        outline,
        outlineOffset: '-12px',
        opacity: isInvalid ? 0.45 : 1,
        cursor: isInvalid ? 'not-allowed' : isValid ? 'copy' : undefined,
        backgroundImage: stripeImage,
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
