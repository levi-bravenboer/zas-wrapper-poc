import type { OwnerType } from './types'

// Keyed by the realtime resource name (`notes`) so the realtime-invalidation
// provider — which invalidates by `[event.resource]` — matches these queries on
// a cross-user write. Files are notes too, so one key covers the whole feed.

export function notesKey(ownerType: OwnerType, ownerId: string): readonly unknown[] {
  return ['notes', ownerType, ownerId] as const
}
