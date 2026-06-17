import { type ReactElement } from 'react'

import type { PhaseBand } from './useRuntimeGraph'

const PAD_X = 40
const PAD_Y = 48

export interface RuntimePhaseBandsProps {
  bands: PhaseBand[]
  height: number
}

// Coloured phase bands behind the nodes (`zIndex: -1`), sized to the x-extent
// of each phase's blocks in the auto-layout. Phases may stretch / overlap.
export function RuntimePhaseBands({ bands, height }: RuntimePhaseBandsProps): ReactElement {
  return (
    <>
      {bands.map((band) => (
        <div
          key={band.id}
          className="pointer-events-none absolute rounded-xl"
          style={{
            left: band.x - PAD_X,
            top: -PAD_Y,
            width: band.width + PAD_X * 2,
            height: height + PAD_Y * 2,
            background: band.soft,
            zIndex: -1,
          }}
        >
          <span
            className="absolute left-4 top-3 text-xs font-semibold uppercase tracking-wide"
            style={{ color: band.ink }}
          >
            {band.label}
          </span>
        </div>
      ))}
    </>
  )
}
