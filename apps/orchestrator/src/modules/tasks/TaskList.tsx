import { useParams } from '@tanstack/react-router'
import { Inbox } from 'lucide-react'
import { useMemo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/states/EmptyState'

import { useTasksQuery } from './api'
import { dayGroupLabel } from './dueLabel'
import { TaskRow } from './TaskRow'
import type { TaskItem } from './types'

type DayGroup = {
  label: string
  items: TaskItem[]
}

function groupByDay(t: ReturnType<typeof useTranslation>['t'], items: TaskItem[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const item of items) {
    const label = dayGroupLabel(t, item.due_at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}

// Realtime invalidation seam (BL-076 follow-up): when the tasks realtime
// topic lands, register it here so `tasksListKeyPrefix` invalidates on
// appointment writes. No-op v1.
export function TaskList(): ReactElement {
  const { t } = useTranslation(['tasks'])
  const query = useTasksQuery()
  const params = useParams({ strict: false })
  // URL drives selection per D-LAYOUT-V12; the active row matches the
  // `$taskId` from `/_auth/tasks/$taskId`.
  const selectedTaskId = (params as { taskId?: string }).taskId

  const groups = useMemo(
    () => (query.data ? groupByDay(t, query.data) : []),
    [query.data, t],
  )

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="task-list">
      <header className="border-b border-border/60 px-4 py-4">
        <h1 className="text-lg font-semibold text-foreground">{t('tasks:title')}</h1>
        <p className="text-xs text-foreground-muted">{t('tasks:subtitle')}</p>
      </header>

      <div className="flex-1 overflow-y-auto" data-testid="task-list-body">
        {query.isLoading ? null : query.isError ? (
          <EmptyState icon={Inbox} title={t('tasks:error.title')} body={t('tasks:error.body')} />
        ) : groups.length === 0 ? (
          <EmptyState icon={Inbox} title={t('tasks:empty.title')} body={t('tasks:empty.body')} />
        ) : (
          groups.map((group) => (
            <section key={group.label}>
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
          ))
        )}
      </div>
    </div>
  )
}
