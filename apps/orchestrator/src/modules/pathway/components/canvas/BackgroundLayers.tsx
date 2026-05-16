import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { LANE_ROW_HEIGHT, PHASE_COL_WIDTH, laneRowY, phaseColumnX } from '../../canvasLayout'
import type { LaneKindCode, PathwayBlock, PathwayLane, PathwayPhase } from '../../types'

import { LaneLabel } from './LaneLabel'
import { LaneRow } from './LaneRow'
import { PhaseColumn } from './PhaseColumn'

type Props = {
  phases: PathwayPhase[]
  lanes: PathwayLane[]
  blocks: PathwayBlock[]
}

export function BackgroundLayers({ phases, lanes, blocks }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const phasesByOrd = [...phases].sort((a, b) => a.ord - b.ord)
  const lanesByOrd = [...lanes].sort((a, b) => a.ord - b.ord)
  const blockByPhase = new Map<string, number>()
  const blockByLane = new Map<string, number>()
  for (const b of blocks) {
    blockByPhase.set(b.phase_id, (blockByPhase.get(b.phase_id) ?? 0) + 1)
    blockByLane.set(b.lane_id, (blockByLane.get(b.lane_id) ?? 0) + 1)
  }

  return (
    <>
      <div className="pointer-events-none absolute inset-0">
        {phasesByOrd.map((phase, i) => (
          <PhaseColumn
            key={phase.id}
            phase={phase}
            index={i}
            blockCount={blockByPhase.get(phase.id) ?? 0}
            xStart={phaseColumnX(i)}
            width={PHASE_COL_WIDTH}
          />
        ))}
        {lanesByOrd.map((lane, i) => (
          <LaneRow
            key={lane.id}
            lane={lane}
            topY={laneRowY(i)}
            height={LANE_ROW_HEIGHT}
            isEmpty={(blockByLane.get(lane.id) ?? 0) === 0}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0">
        {lanesByOrd.map((lane, i) => (
          <LaneLabel
            key={lane.id}
            lane={lane}
            topY={laneRowY(i)}
            blockCount={blockByLane.get(lane.id) ?? 0}
            i18nLaneName={t(`lane.${lane.lane_kind_code as LaneKindCode}`, {
              defaultValue: lane.label,
            })}
          />
        ))}
      </div>
    </>
  )
}
