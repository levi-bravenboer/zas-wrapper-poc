// surface-opt-out: app-only
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { type ReactElement } from 'react'

import { MasterDetailRail } from '@/components/rail'
import { AppointmentList } from '@/modules/appointment/components/AppointmentList'

export const Route = createFileRoute('/_auth/appointments')({
  component: AppointmentsLayoutRoute,
})

function AppointmentsLayoutRoute(): ReactElement {
  return (
    <MasterDetailRail rail={<AppointmentList />}>
      <Outlet />
    </MasterDetailRail>
  )
}
