import { type ReactElement } from 'react'

import { LusciiProgramThumbnailFake } from './LusciiProgramThumbnailFake'
import type { LusciiProgramData } from './types'

type Props = {
  data: LusciiProgramData | null
  width: number
  height: number
}

/**
 * Body-slot dispatcher for the Luscii block thumbnail.
 *
 * `data=null` → Fake renderer (empty state or placeholder built from layout
 * stubs). `data` non-null → real data-driven renderer.
 *
 * In stub mode the dispatcher stays on Fake even when `data` is non-null,
 * because the stub-fed `LusciiProgramData` is already what Fake renders.
 * Only the live-Luscii-adapter change flips the dispatch to Live once real
 * program data shapes arrive — at that point change the `else` branch to
 * `<LusciiProgramThumbnailLive ... />`.
 */
export function LusciiProgramThumbnail({ data, width, height }: Props): ReactElement {
  return <LusciiProgramThumbnailFake data={data} width={width} height={height} />
}
