import { type ReactElement } from 'react'

import type { OwnerType } from '../types'

import { ActivityFeed } from './ActivityFeed'

export type CollaborationColumnProps = {
  ownerType: OwnerType
  ownerId: string
}

/** Activity area for an owner entity — a single feed of notes and files on the
 *  task/appointment/patient detail. A file is just a note with a file. */
export function CollaborationColumn({
  ownerType,
  ownerId,
}: CollaborationColumnProps): ReactElement {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <ActivityFeed ownerType={ownerType} ownerId={ownerId} />
    </div>
  )
}
