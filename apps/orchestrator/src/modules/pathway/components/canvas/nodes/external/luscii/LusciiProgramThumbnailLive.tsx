import { type ReactElement } from 'react'

import type { LusciiProgramData } from './types'

type Props = {
  data: LusciiProgramData
  width: number
  height: number
}

/**
 * Data-driven Luscii program thumbnail.
 *
 * Currently a placeholder shell — the real implementation lands with the
 * live-Luscii-adapter change. Until then, the dispatcher
 * (`LusciiProgramThumbnail`) never reaches this branch in stub mode because
 * the resolved-program data is fed by stub fixtures that the Fake renderer
 * handles identically.
 *
 * Throws on render to make accidental wiring visible in dev.
 */
export function LusciiProgramThumbnailLive(_props: Props): ReactElement {
  throw new Error(
    'LusciiProgramThumbnailLive not implemented yet — the live-Luscii-adapter change replaces this shell.',
  )
}
