import { type ReactElement } from 'react'

import type { OwnerType } from '../types'

import { ActivityFeed } from './ActivityFeed'

export type CollaborationColumnProps = {
  ownerType: OwnerType
  ownerId: string
  /** Patient context for measurement entry. Required to surface the
   *  "Meting toevoegen" affordance and to interleave the patient's
   *  observations into the feed. When omitted (e.g. tasks without a patient,
   *  pathway-step notes) the measurement affordance is hidden. */
  patientId?: string | undefined
}

/** Activity area for an owner entity — a single feed of notes, files, and
 *  patient measurements on the task/appointment/patient detail. A file is
 *  just a note with a file; a measurement is a typed clinical entry. */
export function CollaborationColumn({
  ownerType,
  ownerId,
  patientId,
}: CollaborationColumnProps): ReactElement {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <ActivityFeed ownerType={ownerType} ownerId={ownerId} patientId={patientId} />
    </div>
  )
}
