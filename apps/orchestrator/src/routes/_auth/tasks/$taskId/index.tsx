// surface-opt-out: app-only
import { createFileRoute, Link } from '@tanstack/react-router'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import {
  EntityDetailPage,
  EntityDetailSkeleton,
  EntityErrorCard,
  EntityNotFound,
} from '@/components/entity'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { isApiError } from '@/lib/api/errors'
import { formatDateOrDash } from '@/lib/utils/datetime'
import { useSetTaskStatus, useTaskQuery } from '@/modules/tasks/hooks'

export const Route = createFileRoute('/_auth/tasks/$taskId/')({
  component: TaskDetailRoute,
})

function TaskDetailRoute(): ReactElement {
  const { t, i18n } = useTranslation(['tasks'])
  const { taskId } = Route.useParams()
  const taskQuery = useTaskQuery(taskId)
  const setStatus = useSetTaskStatus(taskId)

  if (taskQuery.isLoading) {
    return <EntityDetailSkeleton />
  }
  if (taskQuery.error) {
    if (isApiError(taskQuery.error) && taskQuery.error.status === 404) {
      return <EntityNotFound backTo={{ to: '/tasks' }} />
    }
    return <EntityErrorCard onRetry={() => void taskQuery.refetch()} />
  }

  const task = taskQuery.data
  if (!task) return <EntityNotFound backTo={{ to: '/tasks' }} />

  const done = task.status === 'done'
  const nextStatus = done ? 'open' : 'done'

  const subtitle = (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={done ? 'soft' : 'default'}>
        {t(`tasks:status.${task.status}`, { defaultValue: task.status })}
      </Badge>
      <span className="text-sm text-muted-foreground">
        {t('tasks:detail.due', {
          defaultValue: 'Deadline: {{date}}',
          date: formatDateOrDash(task.due_at ?? null, i18n.language),
        })}
      </span>
    </div>
  )

  return (
    <EntityDetailPage
      title={task.title}
      subtitle={subtitle}
      back={{ to: '/tasks' }}
      actions={
        <Button
          variant={done ? 'outline' : 'default'}
          disabled={setStatus.isPending}
          onClick={() => setStatus.mutate(nextStatus)}
        >
          {done
            ? t('tasks:detail.reopen', { defaultValue: 'Heropen' })
            : t('tasks:detail.complete', { defaultValue: 'Markeer als afgerond' })}
        </Button>
      }
      body={
        <div className="flex flex-col gap-4 p-1">
          {task.description ? (
            <p className="whitespace-pre-wrap text-sm text-foreground">{task.description}</p>
          ) : (
            <p className="text-sm text-foreground-muted">
              {t('tasks:detail.noDescription', { defaultValue: 'Geen omschrijving.' })}
            </p>
          )}
          {task.patient_id ? (
            <Link
              to="/patients/$patientId"
              params={{ patientId: task.patient_id }}
              className="text-sm font-medium text-primary hover:underline"
            >
              {t('tasks:detail.openPatient', { defaultValue: 'Open patiënt' })}
            </Link>
          ) : null}
        </div>
      }
    />
  )
}
