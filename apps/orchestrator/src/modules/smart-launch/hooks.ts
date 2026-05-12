import type { LaunchSearch } from './schemas'
import { useLaunchStore } from './store'

export function useLaunchContext(): LaunchSearch | null {
  return useLaunchStore((s) => s.context)
}
