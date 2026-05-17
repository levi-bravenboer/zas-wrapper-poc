import { useReactFlow, useStore, useViewport } from '@xyflow/react'
import { useMemo, type ReactElement } from 'react'

import { indexById } from '@/lib/utils/indexBy'
import { sortByOrd } from '@/lib/utils/ordinal'

import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  laneAccent,
  phaseTint,
  type CanvasGeometry,
} from '../../canvasLayout'
import type { PathwayBlock, PathwayEdge, PathwayLane, PathwayPhase } from '../../types'

const MAP_W = 220
const MAP_H = 130
const BLOCK_DEFAULT_X = 70
const BLOCK_DEFAULT_Y = 26

type Props = {
  phases: PathwayPhase[]
  lanes: PathwayLane[]
  blocks: PathwayBlock[]
  edges: PathwayEdge[]
  geometry: CanvasGeometry
  ariaLabel: string
}

export function BuilderMiniMap({
  phases,
  lanes,
  blocks,
  edges,
  geometry,
  ariaLabel,
}: Props): ReactElement {
  const { setCenter } = useReactFlow()
  const viewport = useViewport()
  const containerW = useStore((s) => s.width)
  const containerH = useStore((s) => s.height)

  const phasesByOrd = useMemo(() => sortByOrd(phases), [phases])
  const lanesByOrd = useMemo(() => sortByOrd(lanes), [lanes])
  const lanesById = useMemo(() => indexById(lanes), [lanes])
  const blocksById = useMemo(() => indexById(blocks), [blocks])
  const incomingByTarget = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of edges) m.set(e.target_block_id, (m.get(e.target_block_id) ?? 0) + 1)
    return m
  }, [edges])

  const flowW = geometry.flowWidth
  const flowH = geometry.flowHeight

  const vpX = viewport.zoom > 0 ? -viewport.x / viewport.zoom : 0
  const vpY = viewport.zoom > 0 ? -viewport.y / viewport.zoom : 0
  const vpW = viewport.zoom > 0 ? containerW / viewport.zoom : flowW
  const vpH = viewport.zoom > 0 ? containerH / viewport.zoom : flowH

  const bboxMinX = Math.min(0, vpX)
  const bboxMinY = Math.min(0, vpY)
  const bboxMaxX = Math.max(flowW, vpX + vpW)
  const bboxMaxY = Math.max(flowH, vpY + vpH)
  const bboxW = Math.max(1, bboxMaxX - bboxMinX)
  const bboxH = Math.max(1, bboxMaxY - bboxMinY)
  const scale = Math.min(MAP_W / bboxW, MAP_H / bboxH)
  const inv = scale > 0 ? 1 / scale : 1
  const offsetX = (MAP_W - bboxW * scale) / 2
  const offsetY = (MAP_H - bboxH * scale) / 2

  function blockBox(block: PathwayBlock): { x: number; y: number; w: number; h: number } {
    return {
      x: geometry.phaseX(block.phase_id) + (block.x || BLOCK_DEFAULT_X),
      y: geometry.laneY(block.lane_id) + (block.y || BLOCK_DEFAULT_Y),
      w: BLOCK_WIDTH,
      h: BLOCK_HEIGHT,
    }
  }

  function onClick(event: React.MouseEvent<SVGSVGElement>): void {
    if (scale <= 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const fx = (event.clientX - rect.left - offsetX) / scale + bboxMinX
    const fy = (event.clientY - rect.top - offsetY) / scale + bboxMinY
    setCenter(fx, fy, { duration: 220 })
  }

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={MAP_W}
      height={MAP_H}
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      onClick={onClick}
      className="block cursor-pointer"
    >
      <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="rgba(11,26,23,0.04)" />
      <g
        transform={`translate(${offsetX - bboxMinX * scale} ${offsetY - bboxMinY * scale}) scale(${scale})`}
      >
        {phasesByOrd.map((phase, i) => {
          const tint = phaseTint(i)
          const x = geometry.phaseX(phase.id)
          const w = geometry.phaseW(phase.id)
          return (
            <g key={phase.id}>
              <rect x={x} y={0} width={w} height={flowH} fill={tint.soft} opacity={0.32} />
              <line
                x1={x + w}
                y1={0}
                x2={x + w}
                y2={flowH}
                stroke="rgba(11,26,23,0.08)"
                strokeWidth={inv}
              />
            </g>
          )
        })}
        {lanesByOrd.map((lane) => {
          const accent = laneAccent(lane)
          const y = geometry.laneY(lane.id)
          const h = geometry.laneH(lane.id)
          return (
            <g key={lane.id}>
              <rect x={0} y={y} width={flowW} height={h} fill={accent} opacity={0.05} />
              <line
                x1={0}
                y1={y}
                x2={flowW}
                y2={y}
                stroke={accent}
                strokeOpacity={0.25}
                strokeWidth={inv}
              />
            </g>
          )
        })}
        {edges.map((edge) => {
          const s = blocksById.get(edge.source_block_id)
          const t = blocksById.get(edge.target_block_id)
          if (!s || !t) return null
          const sb = blockBox(s)
          const tb = blockBox(t)
          return (
            <line
              key={edge.id}
              x1={sb.x + sb.w}
              y1={sb.y + sb.h / 2}
              x2={tb.x}
              y2={tb.y + tb.h / 2}
              stroke="rgba(11,26,23,0.45)"
              strokeWidth={2 * inv}
              strokeLinecap="round"
            />
          )
        })}
        {blocks.map((block) => {
          const box = blockBox(block)
          const lane = lanesById.get(block.lane_id) ?? null
          const fill = lane ? laneAccent(lane) : '#cbd1d8'
          const isEntry = (incomingByTarget.get(block.id) ?? 0) === 0
          return (
            <g key={block.id}>
              <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={6} fill={fill} />
              {isEntry && (
                <>
                  <circle
                    cx={box.x + box.w * 0.18}
                    cy={box.y + box.h / 2}
                    r={Math.max(8, box.h * 0.28)}
                    fill="var(--color-primary, #2f7d6b)"
                    stroke="white"
                    strokeWidth={2 * inv}
                  />
                  <polygon
                    points={[
                      `${box.x + box.w * 0.18 - 3},${box.y + box.h / 2 - 5}`,
                      `${box.x + box.w * 0.18 - 3},${box.y + box.h / 2 + 5}`,
                      `${box.x + box.w * 0.18 + 4},${box.y + box.h / 2}`,
                    ].join(' ')}
                    fill="white"
                  />
                </>
              )}
            </g>
          )
        })}
        <rect
          x={vpX}
          y={vpY}
          width={vpW}
          height={vpH}
          fill="rgba(11,26,23,0.05)"
          stroke="rgba(11,26,23,0.55)"
          strokeWidth={1.5 * inv}
          rx={4}
          pointerEvents="none"
        />
      </g>
    </svg>
  )
}
