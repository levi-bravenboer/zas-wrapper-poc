// surface-opt-out: app-only
import { createFileRoute, Link } from '@tanstack/react-router'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DetailCard,
  DetailRow,
  EntityDetailPage,
  EntityDetailSkeleton,
  EntityErrorCard,
  EntityNotFound,
} from '@/components/entity'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { isApiError } from '@/lib/api/errors'
import { formatDateOrDash } from '@/lib/utils/datetime'
import { CollaborationColumn } from '@/modules/collaboration/components'
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
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(260px,320px)_1fr]">
          <DetailCard title={t('tasks:detail.tabs.info', { defaultValue: 'Details' })}>
            <DetailRow label={t('tasks:detail.description', { defaultValue: 'Omschrijving' })}>
              {task.description ? (
                <span className="whitespace-pre-wrap">{task.description}</span>
              ) : (
                <span className="text-foreground-muted">
                  {t('tasks:detail.noDescription', { defaultValue: 'Geen omschrijving.' })}
                </span>
              )}
            </DetailRow>
            <DetailRow label={t('tasks:detail.deadline', { defaultValue: 'Deadline' })}>
              {formatDateOrDash(task.due_at ?? null, i18n.language)}
            </DetailRow>
            <DetailRow label={t('tasks:detail.status', { defaultValue: 'Status' })}>
              <Badge variant={done ? 'soft' : 'default'}>
                {t(`tasks:status.${task.status}`, { defaultValue: task.status })}
              </Badge>
            </DetailRow>
            {task.patient_id ? (
              <DetailRow label={t('tasks:detail.patient', { defaultValue: 'Patiënt' })}>
                <Link
                  to="/patients/$patientId"
                  params={{ patientId: task.patient_id }}
                  className="font-medium text-primary hover:underline"
                >
                  {t('tasks:detail.openPatient', { defaultValue: 'Open patiënt' })}
                </Link>
              </DetailRow>
            ) : null}
          </DetailCard>

          <CollaborationColumn ownerType="task" ownerId={task.id} />
        </div>
      }
    />
  )
}
