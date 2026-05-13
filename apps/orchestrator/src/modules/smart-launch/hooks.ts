import { useLaunchStore, type LaunchContext } from './store'

export function useLaunchContext(): LaunchContext | null {
  return useLaunchStore((s) => s.context)
}
