import { type ReactNode } from 'react'

import { SurfaceContext } from './context'
import type { Surface } from './types'

type SurfaceProviderProps = {
  surface: Surface
  children: ReactNode
}

export function SurfaceProvider({ surface, children }: SurfaceProviderProps): ReactNode {
  return <SurfaceContext.Provider value={surface}>{children}</SurfaceContext.Provider>
}
