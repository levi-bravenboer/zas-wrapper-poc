import { create } from 'zustand'

import type { LaunchSearch } from './schemas'

type LaunchState = {
  context: LaunchSearch | null
  setContext: (context: LaunchSearch) => void
  clear: () => void
}

export const useLaunchStore = create<LaunchState>((set) => ({
  context: null,
  setContext: (context) => set({ context }),
  clear: () => set({ context: null }),
}))
