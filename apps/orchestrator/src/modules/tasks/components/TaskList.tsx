import { useParams } from '@tanstack/react-router'
import { Inbox } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/states/EmptyState'
import { RowSkeleton } from '@/components/states/Skeleton'

import { dayGroupLabel } from '../dueLabel'
import { useTasksQuery } from '../hooks'
import type { Task } from '../types'
import { TaskRow } from './TaskRow'

type DayGroup = {
  key: string
  label: string
  items: Task[]
}

function calendarDayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function groupByDay(t: ReturnType<typeof useTranslation>['t'], items: Task[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const item of items) {
    const key = item.due_at ? calendarDayKey(item.due_at) : 'none'
    const label = item.due_at
      ? dayGroupLabel(t, item.due_at)
      : t('tasks:group.none', { defaultValue: 'Geen datum' })
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(item)
    else groups.push({ key, label, items: [item] })
  }
  return groups
}

function TaskListBody({ selectedTaskId }: { selectedTaskId: string | undefined }): ReactElement {
  const { t } = useTranslation(['tasks'])
  const query = useTasksQuery()

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-2 p-3" aria-busy data-testid="task-list-loading">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    )
  }
  if (query.isError) {
    return <EmptyState icon={Inbox} title={t('tasks:error.title')} body={t('tasks:error.body')} />
  }

  const groups = groupByDay(t, query.data ?? [])
  if (groups.length === 0) {
    return <EmptyState icon={Inbox} title={t('tasks:empty.title')} body={t('tasks:empty.body')} />
  }

  return (
    <>
      {groups.map((group) => (
        <section key={group.key}>
          <h2 className="sticky top-0 z-10 bg-background/95 px-4 pb-1 pt-3 text-[11px] uppercase tracking-wider text-foreground-muted backdrop-blur-sm">
            {group.label}
          </h2>
          <ul className="flex flex-col">
            {group.items.map((item) => (
              <li key={item.id}>
                <TaskRow item={item} selected={selectedTaskId === item.id} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

// Realtime invalidation seam (BL-076 follow-up): when the tasks realtime
// topic lands, register it here so `tasksListKeyPrefix` invalidates on
// appointment writes. No-op v1.
export function TaskList(): ReactElement {
  const { t } = useTranslation(['tasks'])
  const params = useParams({ strict: false })
  // URL drives selection per D-LAYOUT-V12; the active row matches the
  // `$taskId` from `/_auth/tasks/$taskId`. Cast needed: strict:false widens
  // params to the union of all routes, which erases the optional `taskId`.
  const selectedTaskId = (params as { taskId?: string }).taskId

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="task-list">
      <header className="border-b border-border/60 px-4 py-4">
        <h1 className="text-lg font-semibold text-foreground">{t('tasks:title')}</h1>
        <p className="text-xs text-foreground-muted">{t('tasks:subtitle')}</p>
      </header>

      <div className="flex-1 overflow-y-auto" data-testid="task-list-body">
        <TaskListBody selectedTaskId={selectedTaskId} />
      </div>
    </div>
  )
}
