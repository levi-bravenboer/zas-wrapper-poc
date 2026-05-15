import { createContext, useContext, useEffect } from 'react'

import type { CommandEntry } from './types'

export type CommandPaletteContextValue = {
  open: boolean
  setOpen: (next: boolean) => void
  toggle: () => void
  entries: readonly CommandEntry[]
  register: (key: string, entries: readonly CommandEntry[]) => () => void
}

export const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null)

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider')
  }
  return ctx
}

// Page-level hook: register a stable set of commands under a unique `key`.
// Re-registering with the same key replaces the previous set. Wrap `entries`
// in `useMemo` at the call site to avoid registration churn.
export function useRegisterCommands(key: string, entries: readonly CommandEntry[]): void {
  const { register } = useCommandPalette()
  useEffect(() => register(key, entries), [register, key, entries])
}
