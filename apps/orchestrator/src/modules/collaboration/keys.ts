import type { OwnerType } from './types'

export function notesKey(ownerType: OwnerType, ownerId: string): readonly unknown[] {
  return ['collaboration', 'notes', ownerType, ownerId] as const
}

export function attachmentsKey(ownerType: OwnerType, ownerId: string): readonly unknown[] {
  return ['collaboration', 'attachments', ownerType, ownerId] as const
}
