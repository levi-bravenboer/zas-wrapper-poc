import type { LusciiWindowDays } from '../../hooks'

export interface ReplicaPreset {
  key: string
  days: LusciiWindowDays
}

// Luscii's preset row, left to right. Dev-editable; each maps to a days-back
// window the backend already supports.
export const REPLICA_PRESETS: ReplicaPreset[] = [
  { key: '7D', days: 7 },
  { key: '14D', days: 14 },
  { key: '30D', days: 30 },
  { key: '3M', days: 90 },
  { key: '6M', days: 180 },
  { key: '12M', days: 365 },
]
