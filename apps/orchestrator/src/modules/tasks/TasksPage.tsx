import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { tasksPort } from './ports'

export function TasksPage() {
  const { t } = useTranslation('nav')
  const port = tasksPort.use()
  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'list'] as const,
    queryFn: () => port.list(),
  })

  return (
    <section className="mx-auto max-w-3xl p-8">
      <h1 className="text-5xl font-bold tracking-tight">{t('tasks')}</h1>
      {isLoading ? (
        <p className="mt-2 text-muted-foreground" data-testid="tasks-loading">
          {t('loading')}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2" data-testid="tasks-list">
          {(data ?? []).map((task) => (
            <li
              key={task.id}
              className="rounded-md border border-border bg-card px-4 py-3 text-sm"
              data-testid={`task-${task.id}`}
              data-status={task.status}
            >
              {task.title}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
