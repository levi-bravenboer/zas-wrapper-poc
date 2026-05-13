import { useContext } from 'react'

import { SurfaceContext } from './context'
import type { Surface } from './types'

export function useSurface(): Surface {
  const value = useContext(SurfaceContext)
  if (value === null) {
    throw new Error('useSurface called outside SurfaceProvider')
  }
  return value
}

export function useIsEmbed(): boolean {
  return useSurface().id === 'embed'
}

export function useIsSmart(): boolean {
  return useSurface().id === 'smart'
}

export function useSurfaceBasePath(): string {
  return useSurface().basePath
}
