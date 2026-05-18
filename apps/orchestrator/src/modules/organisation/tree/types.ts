import type { OrganisationRead, OrganisationTreeMove } from '../schemas'

export interface FlatItem {
  id: string
  parentId: string | null
  depth: number
  hasChildren: boolean
  collapsed: boolean
}

export type PendingMoves = ReadonlyMap<string, OrganisationTreeMove>

export type { OrganisationRead }
