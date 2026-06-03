import { type ReactElement } from 'react'

import { CareTeamEditor } from '@/modules/care-team/components/CareTeamEditor'

export interface CareTeamSlotProps {
  patientId: string
}

export function CareTeamSlot({ patientId }: CareTeamSlotProps): ReactElement {
  return <CareTeamEditor patientId={patientId} />
}
