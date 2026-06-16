import { type ReactElement } from 'react'

import { AttachmentsPanel } from './AttachmentsPanel'
import { NotesPanel } from './NotesPanel'
import type { OwnerType } from '../types'

export type CollaborationColumnProps = {
  ownerType: OwnerType
  ownerId: string
}

/** Stacked notes + documents for an owner entity — the shared activity column
 *  on task/appointment/patient detail. */
export function CollaborationColumn({ ownerType, ownerId }: CollaborationColumnProps): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <NotesPanel ownerType={ownerType} ownerId={ownerId} />
      <AttachmentsPanel ownerType={ownerType} ownerId={ownerId} />
    </div>
  )
}
