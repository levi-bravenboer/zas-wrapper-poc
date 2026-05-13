import { createContext } from 'react'

import type { Surface } from './types'

export const SurfaceContext = createContext<Surface | null>(null)
