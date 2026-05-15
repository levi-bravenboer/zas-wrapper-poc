import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'

import {
  CommandPaletteContext,
  type CommandPaletteContextValue,
} from './context'
import type { CommandEntry } from './types'

type RegistrationMap = ReadonlyMap<string, readonly CommandEntry[]>

export function CommandPaletteProvider({ children }: { children: ReactNode }): ReactElement {
  const [open, setOpen] = useState(false)
  const [registrations, setRegistrations] = useState<RegistrationMap>(() => new Map())

  const toggle = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  const register = useCallback(
    (key: string, nextEntries: readonly CommandEntry[]): (() => void) => {
      setRegistrations((map) => {
        const next = new Map(map)
        next.set(key, nextEntries)
        return next
      })
      return () => {
        setRegistrations((map) => {
          if (!map.has(key)) return map
          const next = new Map(map)
          next.delete(key)
          return next
        })
      }
    },
    [],
  )

  const entries = useMemo<readonly CommandEntry[]>(
    () => Array.from(registrations.values()).flat(),
    [registrations],
  )

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      const isToggle = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (!isToggle) return
      event.preventDefault()
      setOpen((prev) => !prev)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const value = useMemo<CommandPaletteContextValue>(
    () => ({ open, setOpen, toggle, entries, register }),
    [open, toggle, entries, register],
  )

  return <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>
}
