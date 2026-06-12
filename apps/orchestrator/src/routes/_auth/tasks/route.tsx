// surface-opt-out: app-only
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { type ReactElement } from 'react'

import { TaskList } from '@/modules/tasks'

export const Route = createFileRoute('/_auth/tasks')({
  component: TasksLayoutRoute,
  staticData: { breadcrumb: 'Taken' },
})

/**
 * Two-column flex layout per design.md D-LAYOUT-V12:
 *
 * - Left: fixed 280px `<TaskList>` rail. Always visible at ≥md.
 * - Right: `<Outlet />`. Renders the selection empty state when the URL is
 *   `/_auth/tasks`, the task detail when the URL is `/_auth/tasks/$taskId`.
 *
 * No `<MasterDetailLayout>`; no collapse state machine. URL drives selection.
 * Active rail row reflects the URL via TanStack Router's params match inside
 * the `<TaskRow>` itself (no parent-owned state).
 */
function TasksLayoutRoute(): ReactElement {
  return (
    <div className="flex h-full min-h-0 w-full">
      <aside className="hidden w-[280px] shrink-0 flex-col border-r border-border bg-background md:flex">
        <TaskList />
      </aside>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
