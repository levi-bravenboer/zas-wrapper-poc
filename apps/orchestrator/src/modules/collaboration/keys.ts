import type { OwnerType } from './types'

// Keys are prefixed with the realtime resource name (`notes` / `attachments`)
// so the realtime-invalidation provider — which invalidates by `[event.resource]`
// — matches these queries on a cross-user write.

export function notesKey(ownerType: OwnerType, ownerId: string): readonly unknown[] {
  return ['notes', ownerType, ownerId] as const
}

export function attachmentsKey(ownerType: OwnerType, ownerId: string): readonly unknown[] {
  return ['attachments', ownerType, ownerId] as const
}
