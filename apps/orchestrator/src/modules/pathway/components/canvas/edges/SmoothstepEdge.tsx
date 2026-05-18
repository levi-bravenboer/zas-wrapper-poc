import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import { type ReactElement } from 'react'

import {
  EDGE_BORDER_RADIUS,
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
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: EDGE_BORDER_RADIUS,
  })
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: variantStyle.stroke,
          strokeWidth: variantStyle.width + (selected ? EDGE_SELECTED_STROKE_BUMP : 0),
          strokeDasharray: variantStyle.dash,
          fill: 'none',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }}
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
    </>
  )
}
