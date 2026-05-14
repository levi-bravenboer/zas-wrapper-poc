import type Client from 'fhirclient/lib/Client'
import type { fhirclient } from 'fhirclient/lib/types'
import { create } from 'zustand'

import type { LaunchSearch } from './schemas'
import type { LaunchContext, SmartCtx } from './types'

type LaunchState = {
  context: LaunchContext | null
  setContext: (context: LaunchContext) => void
  setFromSearch: (search: LaunchSearch) => void
  setSession: (session: { client: Client; token: fhirclient.TokenResponse; ctx: SmartCtx }) => void
  clear: () => void
}

export const useLaunchStore = create<LaunchState>((set) => ({
  context: null,
  setContext: (context) => set({ context }),
  setFromSearch: (search) =>
    set({
      context: {
        iss: search.iss,
        launch: search.launch,
        surface: search.surface,
        returnPath: search.return ?? null,
        client: null,
        token: null,
        ctx: {},
      },
    }),
  setSession: ({ client, token, ctx }) =>
    set((state) => {
      if (!state.context) {
        throw new Error('cannot set session without launch context')
      }
      return { context: { ...state.context, client, token, ctx } }
    }),
  clear: () => set({ context: null }),
}))
