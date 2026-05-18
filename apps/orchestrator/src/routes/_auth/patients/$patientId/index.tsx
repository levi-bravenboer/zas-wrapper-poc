import { createFileRoute } from '@tanstack/react-router'
import { type ReactElement } from 'react'

import { PatientProfilePage } from '@/modules/patient/components/PatientProfilePage'

export const Route = createFileRoute('/_auth/patients/$patientId/')({
  component: PatientDetailRoute,
})

function PatientDetailRoute(): ReactElement {
  const { patientId } = Route.useParams()
  return <PatientProfilePage patientId={patientId} />
}
