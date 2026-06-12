import { useParams } from '@tanstack/react-router'
import { Inbox } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/states/EmptyState'

import { useTasksQuery } from './api'
import { TaskRow } from './TaskRow'

export function TaskList(): ReactElement {
  const { t } = useTranslation(['tasks'])
  const query = useTasksQuery()
  const params = useParams({ strict: false })
  // URL drives selection per D-LAYOUT-V12; the active row matches the
  // `$taskId` from `/_auth/tasks/$taskId`.
  const selectedTaskId = (params as { taskId?: string }).taskId

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="task-list">
      <header className="border-b border-border/60 px-6 py-4">
        <h1 className="text-lg font-semibold text-foreground">{t('tasks:title')}</h1>
        <p className="text-xs text-foreground-muted">{t('tasks:subtitle')}</p>
      </header>

      <div className="flex-1 overflow-y-auto" data-testid="task-list-body">
        {query.isLoading ? null : query.isError ? (
          <EmptyState icon={Inbox} title={t('tasks:error.title')} body={t('tasks:error.body')} />
        ) : !query.data || query.data.length === 0 ? (
          <EmptyState icon={Inbox} title={t('tasks:empty.title')} body={t('tasks:empty.body')} />
        ) : (
          <ul className="flex flex-col">
            {query.data.map((item) => (
              <li key={item.id}>
                <TaskRow item={item} selected={selectedTaskId === item.id} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
