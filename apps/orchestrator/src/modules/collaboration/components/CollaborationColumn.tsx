import { type ReactElement } from 'react'

import { AttachmentsPanel } from './AttachmentsPanel'
import { NotesPanel } from './NotesPanel'
import type { OwnerType } from '../types'

export type CollaborationColumnProps = {
  ownerType: OwnerType
  ownerId: string
}

/** Notes + documents for an owner entity — the shared activity area on
 *  task/appointment/patient detail. Side by side from `lg` up (notes wider),
 *  stacked below. */
export function CollaborationColumn({ ownerType, ownerId }: CollaborationColumnProps): ReactElement {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <NotesPanel ownerType={ownerType} ownerId={ownerId} />
      <AttachmentsPanel ownerType={ownerType} ownerId={ownerId} />
    </div>
  )
}
