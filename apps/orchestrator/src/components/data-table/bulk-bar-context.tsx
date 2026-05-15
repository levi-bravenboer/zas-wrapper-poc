import { createContext } from 'react'

export interface BulkBarContextValue {
  count: number
  onCancel: () => void
  visible: boolean
}

export const BulkBarContext = createContext<BulkBarContextValue | null>(null)
