import { createContext } from 'react'

import type { SaveState } from '../topbar/SaveStatusPill'

export type BuilderFlushContextValue = {
  flush: () => void
  saveState: SaveState
}

const noop = (): void => {}

export const BuilderFlushContext = createContext<BuilderFlushContextValue>({
  flush: noop,
  saveState: 'clean',
})
