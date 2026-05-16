import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import { type ReactElement } from 'react'

export type SmoothstepEdgeData = {
  variant?: 'default' | 'primary' | 'dashed'
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
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 10,
  })
  const isDashed = d.variant === 'dashed'
  const isPrimary = d.variant === 'primary'
  const stroke = isPrimary ? 'var(--color-primary)' : '#cbd1d8'
  const strokeWidth = (isPrimary ? 2 : 1.75) + (selected ? 1 : 0)
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray: isDashed ? '6 4' : undefined,
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
