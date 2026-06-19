import { useParams } from '@tanstack/react-router'
import { Inbox } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { GroupedList, GroupedListSection } from '@/components/rail'
import { EmptyState } from '@/components/states/EmptyState'
import { RowSkeleton } from '@/components/states/Skeleton'
import { groupConsecutiveByDay } from '@/lib/utils/grouping'

import { dayGroupLabel } from '../dueLabel'
import { useTasksQuery } from '../hooks'
import { TaskRow } from './TaskRow'

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

  const groups = groupConsecutiveByDay(query.data ?? [], (task) => task.due_at ?? null)
  if (groups.length === 0) {
    return <EmptyState icon={Inbox} title={t('tasks:empty.title')} body={t('tasks:empty.body')} />
  }

  return (
    <GroupedList>
      {groups.map((group) => {
        const due = group.items[0]?.due_at ?? null
        const label = due ? dayGroupLabel(t, due) : t('tasks:group.none')
        return (
          <GroupedListSection key={group.key} label={label}>
            {group.items.map((item) => (
              <TaskRow key={item.id} item={item} selected={selectedTaskId === item.id} />
            ))}
          </GroupedListSection>
        )
      })}
    </GroupedList>
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
