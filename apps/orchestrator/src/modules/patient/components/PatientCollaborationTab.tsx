import { type ReactElement } from 'react'

import { AttachmentsPanel, NotesPanel } from '@/modules/collaboration/components'

/**
 * Patient-profile "Notities & documenten" tab. For a patient owner the
 * collaboration endpoints return the AGGREGATE — all notes/attachments about
 * the patient across every owner (appointment/task/patient) — so these panels
 * surface everything concerning the patient, split by type (notes vs
 * documents), and also let staff add patient-owned items.
 */
export function PatientCollaborationTab({ patientId }: { patientId: string }): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <NotesPanel ownerType="patient" ownerId={patientId} />
      <AttachmentsPanel ownerType="patient" ownerId={patientId} />
    </div>
  )
}
