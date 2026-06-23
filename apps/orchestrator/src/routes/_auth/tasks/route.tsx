// surface-opt-out: app-only
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { type ReactElement } from 'react'

import { TaskList } from '@/modules/tasks/components/TaskList'

type TasksSearch = { hideList?: boolean }

export const Route = createFileRoute('/_auth/tasks')({
  validateSearch: (search: Record<string, unknown>): TasksSearch => ({
    hideList: search.hideList === true || search.hideList === 'true',
  }),
  component: TasksLayoutRoute,
})

/**
 * Two-column flex layout per design.md D-LAYOUT-V12:
 *
 * - Left: fixed 280px `<TaskList>` rail. Visible at ≥md, hidden when the
 *   `hideList` search param is set (e.g. arriving from a patient task card).
 * - Right: `<Outlet />`. Renders the selection empty state when the URL is
 *   `/_auth/tasks`, the task detail when the URL is `/_auth/tasks/$taskId`.
 *
 * No `<MasterDetailLayout>`; no collapse state machine. URL drives selection.
 * Plain divs — the surrounding shell already owns the `<main>` landmark and
 * the project bans `<aside>` outside the shell.
 */
function TasksLayoutRoute(): ReactElement {
  const { hideList } = Route.useSearch()
  return (
    <div className="flex h-full min-h-0 w-full">
      {hideList ? null : (
        <div className="hidden w-[280px] shrink-0 flex-col border-r border-border bg-background md:flex">
          <TaskList />
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
