// surface-opt-out: app-only
import { createFileRoute } from '@tanstack/react-router'
import { ClipboardList } from 'lucide-react'
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
import { formatDateOrDash, formatDateTimeOrDash } from '@/lib/utils/datetime'
import { CollaborationColumn } from '@/modules/collaboration/components'
import { PatientSummaryCard } from '@/modules/patient/components/PatientSummaryCard'
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
          {done ? t('tasks:detail.reopen') : t('tasks:detail.complete')}
        </Button>
      }
      body={
        <div className="flex w-full flex-col gap-6">
          {task.patient_id ? <PatientSummaryCard patientId={task.patient_id} /> : null}

          <DetailCard icon={ClipboardList} title={t('tasks:detail.tabs.info')}>
            <DetailRow wide label={t('tasks:detail.reason')}>
              {task.description ? (
                <span className="whitespace-pre-wrap">{task.description}</span>
              ) : (
                <span className="text-foreground-muted">{t('tasks:detail.noDescription')}</span>
              )}
            </DetailRow>
            <DetailRow label={t('tasks:detail.deadline')}>
              {formatDateOrDash(task.due_at ?? null, i18n.language)}
            </DetailRow>
            <DetailRow label={t('tasks:detail.status')}>
              <Badge variant={done ? 'soft' : 'default'}>
                {t(`tasks:status.${task.status}`, { defaultValue: task.status })}
              </Badge>
            </DetailRow>
            {task.source_ref ? (
              <DetailRow label={t('tasks:detail.source')}>{task.source_ref}</DetailRow>
            ) : null}
            <DetailRow label={t('tasks:detail.created')}>
              {formatDateTimeOrDash(task.created_at, i18n.language)}
            </DetailRow>
          </DetailCard>

          <CollaborationColumn
            ownerType="task"
            ownerId={task.id}
            patientId={task.patient_id ?? undefined}
          />
        </div>
      }
    />
  )
}
