import { createFileRoute } from '@tanstack/react-router'
import { type ReactElement } from 'react'

import { PatientListPage } from '@/modules/patient/components/PatientListPage'

export const Route = createFileRoute('/_auth/patients/')({
  component: PatientsRoute,
})

function PatientsRoute(): ReactElement {
  return <PatientListPage />
}
