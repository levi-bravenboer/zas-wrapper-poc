import { useCallback, useState } from 'react'

export interface UseTableExpansionApi {
  expandedId: string | null
  toggle: (id: string) => void
}

export function useTableExpansion(): UseTableExpansionApi {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const toggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])
  return { expandedId, toggle }
}
