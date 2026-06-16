import { type ReactElement } from 'react'

import { CollaborationColumn } from '@/modules/collaboration/components'

/**
 * Patient-profile "Notities & documenten" tab. For a patient owner the
 * collaboration endpoints return the AGGREGATE — all notes/attachments about
 * the patient across every owner (appointment/task/patient) — so these panels
 * surface everything concerning the patient, split by type (notes vs
 * documents), and also let staff add patient-owned items.
 */
export function PatientCollaborationTab({ patientId }: { patientId: string }): ReactElement {
  return <CollaborationColumn ownerType="patient" ownerId={patientId} />
}
