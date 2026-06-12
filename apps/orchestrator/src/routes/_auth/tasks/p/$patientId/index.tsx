// surface-opt-out: app-only
import { createFileRoute } from '@tanstack/react-router'
import { type ReactElement } from 'react'

export const Route = createFileRoute('/_auth/tasks/p/$patientId/')({
  component: TaskPatientDetailRoute,
})

function TaskPatientDetailRoute(): ReactElement {
  const { patientId } = Route.useParams()
  // <PatientDetailView> lands in section 9. Stub for now so route + master/detail
  // wiring (section 10) can be exercised end-to-end before the detail body is built.
  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="text-sm text-foreground-muted">Patiëntdetail volgt: {patientId}</p>
    </div>
  )
}
