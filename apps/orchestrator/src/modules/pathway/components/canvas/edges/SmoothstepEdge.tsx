import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import { Pencil } from 'lucide-react'
import { useState, type ReactElement } from 'react'

import {
  EDGE_BORDER_RADIUS,
  EDGE_HOVER_STROKE_BUMP,
  EDGE_INTERACTION_WIDTH,
  EDGE_SELECTED_STROKE_BUMP,
  EDGE_VARIANT_STYLE,
  type EdgeVariant,
} from '../../../constants/edge'

export type SmoothstepEdgeData = {
  variant?: EdgeVariant
  label?: string | null
}

export function SmoothstepEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps): ReactElement {
  const d = (data ?? {}) as SmoothstepEdgeData
  const variantStyle = EDGE_VARIANT_STYLE[d.variant ?? 'default']
  const [hovered, setHovered] = useState(false)
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: EDGE_BORDER_RADIUS,
  })
  const active = hovered || selected
  const strokeWidth =
    variantStyle.width +
    (selected ? EDGE_SELECTED_STROKE_BUMP : 0) +
    (hovered ? EDGE_HOVER_STROKE_BUMP : 0)
  const stroke = active ? (variantStyle.hoverStroke ?? variantStyle.stroke) : variantStyle.stroke
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={0}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray: variantStyle.dash,
          fill: 'none',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          transition: 'stroke 120ms ease, stroke-width 120ms ease',
        }}
      />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeOpacity={0}
        strokeWidth={EDGE_INTERACTION_WIDTH}
        className="react-flow__edge-interaction"
        style={{ pointerEvents: 'stroke' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {d.label && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85 px-1.5 py-px text-[11px] tabular-nums text-muted-foreground"
            style={{ left: labelX, top: labelY }}
          >
            {d.label}
          </div>
        </EdgeLabelRenderer>
      )}
      {active && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-muted-foreground shadow-sm"
            style={{
              left: labelX,
              top: labelY + (d.label ? 14 : 0),
              opacity: active ? 1 : 0,
              transition: 'opacity 120ms ease',
            }}
            aria-hidden
          >
            <Pencil className="h-3 w-3" />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
