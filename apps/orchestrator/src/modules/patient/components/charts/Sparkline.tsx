import { type ReactElement } from 'react'

import { cn } from '@/lib/style/cn'

import type { LusciiNumericPoint, LusciiOrdinalPoint } from './types'

export interface SparklineProps {
  points: (LusciiNumericPoint | LusciiOrdinalPoint)[]
  className?: string
  width?: number
  height?: number
  /** CSS var name (without `--`) for the stroke colour. Defaults to chart-1. */
  colorVar?: string
}

/**
 * Compact non-interactive sparkline used inside the InstrumentCard header.
 * Hidden by the caller when `points.length < 2` per D-SPARSE (a two-point
 * line still reads as a trend; a one-point line is meaningless). When
 * rendered, all points connect — no dots, no axes, no tooltips.
 */
export function Sparkline({
  points,
  className,
  width = 112,
  height = 28,
  colorVar = 'color-chart-1',
}: SparklineProps): ReactElement | null {
  if (points.length < 2) return null

  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1 // avoid div-by-zero on flat lines

  const pad = 2
  const w = width
  const h = height
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0

  const path = points
    .map((p, i) => {
      const x = pad + i * step
      const y = pad + (1 - (p.value - min) / range) * (h - pad * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden
      data-testid="sparkline"
      className={cn('h-7 w-28 shrink-0', className)}
    >
      <path
        d={path}
        fill="none"
        stroke={`var(--${colorVar})`}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
