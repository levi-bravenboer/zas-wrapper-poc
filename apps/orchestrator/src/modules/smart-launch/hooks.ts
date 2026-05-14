import { useLaunchStore } from './store'
import type { LaunchContext } from './types'

export function useLaunchContext(): LaunchContext | null {
  return useLaunchStore((s) => s.context)
}
