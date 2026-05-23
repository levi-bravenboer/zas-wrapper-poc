import { type ReactElement } from 'react'

import type {
  LusciiLaneKind,
  LusciiLayout,
  LusciiLayoutNode,
  LusciiProgramData,
} from './types'

type Props = {
  data: LusciiProgramData | null
  width: number
  height: number
}

// Visual reference: openspec/changes/external-block-integrations/prototypes/
// luscii-block-mini-pathway/v3.html (variant C1).
//
// Mirrors the parent canvas vocabulary at thumbnail scale: phase column tints
// + lane row bands + abstract node rectangles + smoothstep-ish connectors.
// Built from the program's `layout` so even the "fake" reflects which program
// is selected; when no program is picked the empty-state CTA renders instead.

// Phase column tints + lane accents — matches the parent canvas vocabulary
// (`apps/orchestrator/src/styles/builder.css`). Hex literals stay co-located
// here because at thumbnail scale we never read the live CSS variables.
const PHASE_TINTS = [
  { soft: '#cfede8', ink: '#08453c' },
  { soft: '#ede9fe', ink: '#5b21b6' },
  { soft: '#dbeafe', ink: '#1d4ed8' },
  { soft: '#fef3c7', ink: '#92400e' },
] as const

// Typed against the generated `LusciiLaneKind` union so adding a new kind
// in the OpenAPI schema forces a compile error here — we cannot silently
// drop a lane kind into the fallback bucket.
const LANE_ACCENTS = {
  patient: '#266b5e',
  caregiver: '#2563eb',
  external: '#b45309',
  system: '#7c3aed',
} as const satisfies Record<LusciiLaneKind, string>

function resolveLaneAccent(kind: LusciiLaneKind | undefined): string {
  return kind ? LANE_ACCENTS[kind] : LANE_ACCENTS.external
}

/** Pixel rect for one node inside the thumbnail viewBox. */
function nodeRect(
  node: LusciiLayoutNode,
  layout: LusciiLayout,
  vbWidth: number,
  vbHeight: number,
): { x: number; y: number; w: number; h: number; accent: string } {
  const phaseCount = Math.max(1, layout.phases.length)
  const laneCount = Math.max(1, layout.lanes.length)
  const phaseIdx = layout.phases.findIndex((p) => p.id === node.phase_id)
  const laneIdx = layout.lanes.findIndex((l) => l.id === node.lane_id)
  const phaseW = vbWidth / phaseCount
  const laneH = vbHeight / laneCount
  // Node footprint ~ 50% of the cell; centered horizontally, slight top bias.
  const w = Math.max(18, phaseW * 0.55)
  const h = Math.max(8, Math.min(14, laneH * 0.45))
  const x = Math.max(0, phaseIdx) * phaseW + (phaseW - w) / 2
  const y = Math.max(0, laneIdx) * laneH + (laneH - h) / 2
  const lane = layout.lanes[laneIdx >= 0 ? laneIdx : 0]
  const accent = resolveLaneAccent(lane?.kind)
  return { x, y, w, h, accent }
}

export function LusciiProgramThumbnailFake({ data, width, height }: Props): ReactElement {
  if (!data) {
    return <LusciiEmptyState width={width} height={height} />
  }

  const layout = data.layout
  // Body viewBox accounts for the title-overlay strip at top (~36px) and a
  // little breathing room everywhere else. Renderer math uses this rect.
  const vbX = 8
  const vbY = 44
  const vbW = Math.max(0, width - vbX * 2)
  const vbH = Math.max(0, height - vbY - 12)

  const phaseCount = Math.max(1, layout.phases.length)
  const laneCount = Math.max(1, layout.lanes.length)
  const phaseW = vbW / phaseCount
  const laneH = vbH / laneCount

  const nodes = layout.nodes ?? []
  const edges = layout.edges ?? []
  const nodesById = new Map(nodes.map((n) => [n.id, n]))

  return (
    <svg
      data-slot="luscii-program-thumbnail-fake"
      className="pointer-events-none absolute inset-0 size-full"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <g transform={`translate(${vbX}, ${vbY})`}>
        {/* Phase column tints */}
        {layout.phases.map((phase, i) => {
          const tint = PHASE_TINTS[i % PHASE_TINTS.length]
          return (
            <rect
              key={phase.id}
              x={i * phaseW}
              y={0}
              width={phaseW}
              height={vbH}
              fill={tint?.soft ?? '#eef2f0'}
              opacity={0.45}
            />
          )
        })}
        {/* Phase column dashed dividers */}
        {layout.phases.slice(1).map((phase, i) => (
          <line
            key={phase.id}
            x1={(i + 1) * phaseW}
            y1={0}
            x2={(i + 1) * phaseW}
            y2={vbH}
            stroke="rgba(0,0,0,0.06)"
            strokeDasharray="2 3"
          />
        ))}
        {/* Lane row bands */}
        {layout.lanes.map((lane, i) => {
          const accent = resolveLaneAccent(lane.kind)
          return (
            <g key={lane.id}>
              <rect
                x={0}
                y={i * laneH}
                width={vbW}
                height={laneH}
                fill={accent}
                opacity={0.06}
              />
              <line
                x1={0}
                y1={i * laneH}
                x2={vbW}
                y2={i * laneH}
                stroke={accent}
                strokeWidth={0.8}
                opacity={i === 0 ? 0 : 0.22}
              />
            </g>
          )
        })}
        {/* Edges — smoothstep-ish curves between node centers */}
        {edges.map((edge) => {
          const source = nodesById.get(edge.source)
          const target = nodesById.get(edge.target)
          if (!source || !target) return null
          const s = nodeRect(source, layout, vbW, vbH)
          const t = nodeRect(target, layout, vbW, vbH)
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
        {/* Nodes */}
        {nodes.map((node) => {
          const r = nodeRect(node, layout, vbW, vbH)
          return (
            <rect
              key={node.id}
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

function LusciiEmptyState({ width, height }: { width: number; height: number }): ReactElement {
  return (
    <svg
      data-slot="luscii-program-thumbnail-empty"
      className="pointer-events-none absolute inset-0 size-full"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <text
        x={width / 2}
        y={height / 2 + 12}
        textAnchor="middle"
        className="fill-muted-foreground"
        style={{ font: '500 12px system-ui, -apple-system, sans-serif' }}
      >
        Pick a Luscii program
      </text>
    </svg>
  )
}
