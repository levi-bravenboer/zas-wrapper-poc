import type { ReactElement } from 'react'

import {
  BLOCK_HEIGHT as DEFAULT_BLOCK_HEIGHT,
  BLOCK_WIDTH as DEFAULT_BLOCK_WIDTH,
  buildCanvasGeometry,
} from '../../../../../canvasLayout'
import { laneAccent, phaseTint } from '../../../../../constants/theme'
import type {
  PathwayBlock,
  PathwayEdge,
  PathwayLane,
  PathwayPhase,
} from '../../../../../types'

type Props = {
  phases: PathwayPhase[]
  lanes: PathwayLane[]
  blocks: PathwayBlock[]
  edges: PathwayEdge[]
  width: number
  height: number
}

/**
 * Real miniature of the child pathway's canvas. Uses `buildCanvasGeometry`
 * to compute the same phase/lane/block positions the parent renderer would
 * draw, then scales the result to fit the thumbnail viewport. The mini-DAG
 * is purely visual — no interaction, no labels — but its layout matches
 * what a user sees when they open the child pathway in the builder.
 */
export function NestedPathwayThumbnail({
  phases,
  lanes,
  blocks,
  edges,
  width,
  height,
}: Props): ReactElement {
  const vbX = 8
  const vbY = 44
  const vbW = Math.max(0, width - vbX * 2)
  const vbH = Math.max(0, height - vbY - 36)

  const fitInput = blocks.map((b) => ({
    phase_id: b.phase_id,
    lane_id: b.lane_id,
    x: b.x ?? 0,
    y: b.y ?? 0,
    width: DEFAULT_BLOCK_WIDTH,
    height: DEFAULT_BLOCK_HEIGHT,
  }))

  const sortedPhases = phases.toSorted((a, b) => a.ord - b.ord)
  const sortedLanes = lanes.toSorted((a, b) => a.ord - b.ord)
  const geom = buildCanvasGeometry(sortedPhases, sortedLanes, fitInput)

  // Scale uniform — preserves the aspect ratio of the real canvas.
  const scaleX = vbW / geom.flowWidth
  const scaleY = vbH / geom.flowHeight
  const scale = Math.min(scaleX, scaleY)
  const offsetX = (vbW - geom.flowWidth * scale) / 2
  const offsetY = (vbH - geom.flowHeight * scale) / 2

  const blockRect = (block: PathwayBlock) => {
    const px = geom.phaseX(block.phase_id)
    const ly = geom.laneY(block.lane_id)
    const x = (px + (block.x ?? 0)) * scale + offsetX
    const y = (ly + (block.y ?? 0)) * scale + offsetY
    const w = DEFAULT_BLOCK_WIDTH * scale
    const h = DEFAULT_BLOCK_HEIGHT * scale
    const lane = sortedLanes.find((l) => l.id === block.lane_id)
    const accent = lane ? laneAccent(lane) : 'var(--color-primary)'
    return { x, y, w, h, accent }
  }

  const blocksById = new Map(blocks.map((b) => [b.id, b]))

  return (
    <svg
      data-slot="nested-pathway-thumbnail"
      className="pointer-events-none absolute inset-0 size-full"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <g transform={`translate(${vbX}, ${vbY})`}>
        {sortedPhases.map((phase, i) => {
          const tint = phaseTint(i)
          const x = geom.phaseX(phase.id) * scale + offsetX
          const w = geom.phaseW(phase.id) * scale
          return (
            <rect
              key={phase.id}
              x={x}
              y={0}
              width={w}
              height={vbH}
              fill={tint.soft}
              opacity={0.45}
            />
          )
        })}
        {sortedPhases.slice(1).map((phase) => {
          const x = geom.phaseX(phase.id) * scale + offsetX
          return (
            <line
              key={phase.id}
              x1={x}
              y1={0}
              x2={x}
              y2={vbH}
              stroke="rgba(0,0,0,0.06)"
              strokeDasharray="2 3"
            />
          )
        })}
        {sortedLanes.map((lane, i) => {
          const accent = laneAccent(lane)
          const y = geom.laneY(lane.id) * scale + offsetY
          const h = geom.laneH(lane.id) * scale
          return (
            <g key={lane.id}>
              <rect x={0} y={y} width={vbW} height={h} fill={accent} opacity={0.06} />
              <line
                x1={0}
                y1={y}
                x2={vbW}
                y2={y}
                stroke={accent}
                strokeWidth={0.8}
                opacity={i === 0 ? 0 : 0.22}
              />
            </g>
          )
        })}
        {edges.map((edge) => {
          const source = blocksById.get(edge.source_block_id)
          const target = blocksById.get(edge.target_block_id)
          if (!source || !target) return null
          const s = blockRect(source)
          const t = blockRect(target)
          const sx = s.x + s.w
          const sy = s.y + s.h / 2
          const tx = t.x
          const ty = t.y + t.h / 2
          const cx = sx + (tx - sx) / 2
          return (
            <path
              key={edge.id}
              d={`M ${sx} ${sy} C ${cx} ${sy}, ${cx} ${ty}, ${tx} ${ty}`}
              stroke="rgba(11,26,23,0.4)"
              strokeWidth={1.1}
              fill="none"
            />
          )
        })}
        {blocks.map((block) => {
          const r = blockRect(block)
          return (
            <rect
              key={block.id}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              rx={2.5}
              ry={2.5}
              fill={r.accent}
              opacity={0.85}
            />
          )
        })}
      </g>
    </svg>
  )
}
