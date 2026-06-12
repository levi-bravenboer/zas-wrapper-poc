// surface-opt-out: app-only
import { createFileRoute, Outlet, useMatches } from '@tanstack/react-router'
import { type ReactElement, useState } from 'react'

import { MasterDetailLayout } from '@/components/layout/MasterDetailLayout'
import { TaskList } from '@/modules/tasks'

export const Route = createFileRoute('/_auth/tasks')({
  component: TasksLayoutRoute,
  staticData: { breadcrumb: 'Taken' },
})

function TasksLayoutRoute(): ReactElement {
  const matches = useMatches()
  // Detail child route matches when URL is `/_auth/tasks/p/$patientId`.
  // The child mounts at full depth; we check the leaf route id.
  const hasDetail = matches.some((m) => m.routeId === '/_auth/tasks/p/$patientId/')
  const [masterCollapsed, setMasterCollapsed] = useState(false)

  return (
    <MasterDetailLayout
      master={<TaskList />}
      detail={hasDetail ? <Outlet /> : null}
      masterCollapsed={masterCollapsed}
      onMasterCollapsedChange={setMasterCollapsed}
    />
  )
}
