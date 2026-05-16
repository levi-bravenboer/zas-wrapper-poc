import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { sortByOrd } from '@/lib/utils/ordinal'

import type { CanvasGeometry } from '../../canvasLayout'
import type { LaneKindCode, PathwayBlock, PathwayLane, PathwayPhase } from '../../types'

import { LaneLabel } from './LaneLabel'
import { LaneRow } from './LaneRow'
import { PhaseColumn } from './PhaseColumn'

type Props = {
  phases: PathwayPhase[]
  lanes: PathwayLane[]
  blocks: PathwayBlock[]
  geometry: CanvasGeometry
  onResizePhase: (phaseId: string, width: number) => void
  onResizeLane: (laneId: string, height: number) => void
}

export function BackgroundLayers({
  phases,
  lanes,
  blocks,
  geometry,
  onResizePhase,
  onResizeLane,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const phasesByOrd = sortByOrd(phases)
  const lanesByOrd = sortByOrd(lanes)
  const blockByPhase = new Map<string, number>()
  const blockByLane = new Map<string, number>()
  for (const b of blocks) {
    blockByPhase.set(b.phase_id, (blockByPhase.get(b.phase_id) ?? 0) + 1)
    blockByLane.set(b.lane_id, (blockByLane.get(b.lane_id) ?? 0) + 1)
  }

  return (
    <>
      {phasesByOrd.map((phase, i) => (
        <PhaseColumn
          key={phase.id}
          phase={phase}
          index={i}
          blockCount={blockByPhase.get(phase.id) ?? 0}
          xStart={geometry.phaseX(phase.id)}
          width={geometry.phaseW(phase.id)}
          height={geometry.flowHeight}
          onResize={(w) => onResizePhase(phase.id, w)}
        />
      ))}
      {lanesByOrd.map((lane) => (
        <LaneRow
          key={lane.id}
          lane={lane}
          topY={geometry.laneY(lane.id)}
          height={geometry.laneH(lane.id)}
          width={geometry.flowWidth}
          isEmpty={(blockByLane.get(lane.id) ?? 0) === 0}
          onResize={(h) => onResizeLane(lane.id, h)}
        />
      ))}
      {lanesByOrd.map((lane) => (
        <LaneLabel
          key={lane.id}
          lane={lane}
          topY={geometry.laneY(lane.id)}
          blockCount={blockByLane.get(lane.id) ?? 0}
          i18nLaneName={t(`lane.${lane.lane_kind_code as LaneKindCode}`, {
            defaultValue: lane.label,
          })}
        />
      ))}
    </>
  )
}
