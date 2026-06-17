import { type ReactElement } from 'react'

import { sortByOrd } from '@/lib/utils/ordinal'
import type { CanvasGeometry } from '@/modules/pathway/canvasLayout'
import { phaseTint } from '@/modules/pathway/constants/theme'
import type { PathwayPhase } from '@/modules/pathway/types'

export interface RuntimePhaseLayerProps {
  phases: PathwayPhase[]
  geometry: CanvasGeometry
}

// Read-only phase columns rendered in flow coordinates inside a
// `ViewportPortal`. No swimlanes in the runtime view — phases only, behind
// the nodes (`zIndex: -1`).
export function RuntimePhaseLayer({ phases, geometry }: RuntimePhaseLayerProps): ReactElement {
  const phasesByOrd = sortByOrd(phases)

  return (
    <>
      {phasesByOrd.map((phase, i) => {
        const tint = phaseTint(i)
        return (
          <div
            key={phase.id}
            className="pointer-events-none absolute"
            style={{
              left: geometry.phaseX(phase.id),
              top: 0,
              width: geometry.phaseW(phase.id),
              height: geometry.flowHeight,
              background: tint.soft,
              zIndex: -1,
            }}
          >
            <span
              className="absolute left-3 top-2 text-xs font-semibold uppercase tracking-wide"
              style={{ color: tint.ink }}
            >
              {phase.label}
            </span>
          </div>
        )
      })}
    </>
  )
}
