import type { ReactElement } from 'react'

import { BlockTypeIcon } from '../../../../../blockCatalogue'
import {
  blockOrigin,
  buildCanvasGeometry,
  type BlockFitInput,
} from '../../../../../canvasLayout'
import { laneAccent, phaseTint } from '../../../../../constants/theme'
import { usePathwayBlocks } from '../../../../../hooks'
import type {
  PathwayBlock,
  PathwayBlockType,
  PathwayEdge,
  PathwayLane,
  PathwayPhase,
} from '../../../../../types'
import { getBlockDimensions } from '../../../../../utils/blockDimensions'

type Props = {
  phases: PathwayPhase[]
  lanes: PathwayLane[]
  blocks: PathwayBlock[]
  edges: PathwayEdge[]
  width: number
  height: number
}

/**
 * Real miniature of the child pathway. Renders the same DOM shape as the
 * builder canvas — phase tint columns, lane bands, lane labels, block
 * cards with icon + label, smoothstep-ish edges — at full canvas-geometry
 * coordinates, then scales the entire thing via CSS `transform: scale()`
 * to fit the thumbnail viewport.
 *
 * Why not a nested React Flow: nesting React Flow's runtime corrupts the
 * outer canvas's BackgroundLayers (phase tints disappear on outer
 * pan/zoom). DOM + SVG primitives avoid that interference entirely.
 */
export function NestedPathwayThumbnail({
  phases,
  lanes,
  blocks,
  edges,
  width,
  height,
}: Props): ReactElement {
  const { data: blockTypes = [] } = usePathwayBlocks()

  const headerH = 44
  const footerH = 36
  const vbX = 8
  const vbY = headerH
  const vbW = Math.max(0, width - vbX * 2)
  const vbH = Math.max(0, height - vbY - footerH)

  const typesByCode = new Map(blockTypes.map((t) => [t.type, t]))
  const lanesById = new Map(lanes.map((l) => [l.id, l]))

  const sortedPhases = phases.toSorted((a, b) => a.ord - b.ord)
  const sortedLanes = lanes.toSorted((a, b) => a.ord - b.ord)

  const fitInput: BlockFitInput[] = blocks.map((b) => {
    const dim = getBlockDimensions(b, typesByCode.get(b.type) ?? null)
    return {
      phase_id: b.phase_id,
      lane_id: b.lane_id,
      x: b.x ?? 0,
      y: b.y ?? 0,
      width: dim.width,
      height: dim.height,
    }
  })

  const geom = buildCanvasGeometry(sortedPhases, sortedLanes, fitInput)
  const scale = Math.min(vbW / geom.flowWidth, vbH / geom.flowHeight)
  const offsetX = (vbW - geom.flowWidth * scale) / 2
  const offsetY = (vbH - geom.flowHeight * scale) / 2

  const incoming = new Map<string, number>()
  for (const e of edges) incoming.set(e.target_block_id, (incoming.get(e.target_block_id) ?? 0) + 1)

  return (
    <div
      data-slot="nested-pathway-thumbnail"
      className="pointer-events-none absolute overflow-hidden"
      style={{ left: vbX, top: vbY, width: vbW, height: vbH }}
    >
      <div
        style={{
          position: 'absolute',
          left: offsetX,
          top: offsetY,
          width: geom.flowWidth,
          height: geom.flowHeight,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        {sortedPhases.map((phase, i) => {
          const tint = phaseTint(i)
          return (
            <div
              key={phase.id}
              className="absolute top-0"
              style={{
                left: geom.phaseX(phase.id),
                width: geom.phaseW(phase.id),
                height: geom.flowHeight,
                background: tint.soft,
                opacity: 0.45,
              }}
            />
          )
        })}
        {sortedPhases.slice(1).map((phase) => (
          <div
            key={phase.id}
            className="absolute top-0"
            style={{
              left: geom.phaseX(phase.id),
              width: 0,
              height: geom.flowHeight,
              borderLeft: '1px dashed rgba(0,0,0,0.08)',
            }}
          />
        ))}
        {sortedLanes.map((lane, i) => {
          const accent = laneAccent(lane)
          return (
            <div key={lane.id} className="absolute left-0">
              <div
                className="absolute"
                style={{
                  top: geom.laneY(lane.id),
                  width: geom.flowWidth,
                  height: geom.laneH(lane.id),
                  background: accent,
                  opacity: 0.08,
                }}
              />
              {i > 0 && (
                <div
                  className="absolute"
                  style={{
                    top: geom.laneY(lane.id),
                    width: geom.flowWidth,
                    height: 0,
                    borderTop: `1px solid ${accent}`,
                    opacity: 0.3,
                  }}
                />
              )}
            </div>
          )
        })}
        {sortedLanes.map((lane) => {
          const accent = laneAccent(lane)
          return (
            <div
              key={lane.id}
              className="absolute inline-flex items-center gap-1 rounded-full border bg-white/70 px-2 py-0.5 text-[10px] font-semibold"
              style={{
                left: 8,
                top: geom.laneY(lane.id) + 8,
                borderColor: 'rgba(0,0,0,0.08)',
                color: accent,
              }}
            >
              {lane.label}
            </div>
          )
        })}
        <svg
          className="pointer-events-none absolute left-0 top-0"
          width={geom.flowWidth}
          height={geom.flowHeight}
          style={{ overflow: 'visible' }}
        >
          {edges.map((edge) => {
            const source = blocks.find((b) => b.id === edge.source_block_id)
            const target = blocks.find((b) => b.id === edge.target_block_id)
            if (!source || !target) return null
            const sDim = getBlockDimensions(source, typesByCode.get(source.type) ?? null)
            const tDim = getBlockDimensions(target, typesByCode.get(target.type) ?? null)
            const sPos = blockOrigin(source, geom, sDim)
            const tPos = blockOrigin(target, geom, tDim)
            const sx = sPos.x + sDim.width
            const sy = sPos.y + sDim.height / 2
            const tx = tPos.x
            const ty = tPos.y + tDim.height / 2
            const cx = sx + (tx - sx) / 2
            return (
              <path
                key={edge.id}
                d={`M ${sx} ${sy} C ${cx} ${sy}, ${cx} ${ty}, ${tx} ${ty}`}
                stroke="rgba(11,26,23,0.45)"
                strokeWidth={1.5}
                fill="none"
              />
            )
          })}
        </svg>
        {blocks.map((block) => {
          const lane = lanesById.get(block.lane_id)
          return (
            <MiniBlockCard
              key={block.id}
              block={block}
              blockType={typesByCode.get(block.type) ?? null}
              accent={lane ? laneAccent(lane) : 'var(--color-primary)'}
              geometry={geom}
              isEntry={(incoming.get(block.id) ?? 0) === 0}
            />
          )
        })}
      </div>
    </div>
  )
}

type CardProps = {
  block: PathwayBlock
  blockType: PathwayBlockType | null
  accent: string
  geometry: ReturnType<typeof buildCanvasGeometry>
  isEntry: boolean
}

function MiniBlockCard({
  block,
  blockType,
  accent,
  geometry,
  isEntry,
}: CardProps): ReactElement {
  const dim = getBlockDimensions(block, blockType)
  const pos = blockOrigin(block, geometry, dim)
  const name = block.label?.trim() || blockType?.label || block.type
  return (
    <div
      className="absolute grid grid-cols-[4px_36px_1fr] grid-rows-[auto_auto] rounded-[6px] border bg-card shadow-sm"
      style={{
        left: pos.x,
        top: pos.y,
        width: dim.width,
        height: dim.height,
        ['--lane-accent' as string]: accent,
      }}
    >
      <div className="row-span-2 rounded-l-[5px]" style={{ background: accent }} aria-hidden="true" />
      <div
        className="row-span-2 my-auto ml-1 inline-flex h-7 w-7 items-center justify-center rounded-sm"
        style={{
          background: `color-mix(in srgb, ${accent} 14%, white)`,
          color: accent,
        }}
      >
        <BlockTypeIcon icon={blockType?.icon} className="size-4" strokeWidth={1.7} />
      </div>
      <div className="flex flex-col gap-0.5 pr-2.5 pt-2">
        <span className="truncate text-[13px] font-semibold tracking-tight text-foreground">
          {name}
        </span>
        <span className="truncate text-[11.5px] font-medium text-muted-foreground">
          {blockType?.label ?? block.type}
        </span>
      </div>
      {isEntry && (
        <span
          aria-hidden="true"
          className="absolute -left-px -top-px z-[5] px-[7px] py-[3px] text-[9px] font-bold uppercase tracking-[0.09em] text-white"
          style={{
            background: 'var(--color-primary)',
            borderTopLeftRadius: 6,
            borderBottomRightRadius: 6,
          }}
        >
          START
        </span>
      )}
    </div>
  )
}
