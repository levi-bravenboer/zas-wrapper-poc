// surface-opt-out: app-only
import { createFileRoute } from '@tanstack/react-router'
import { Activity, FlaskConical } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { EntityDetailPage, EntityDetailSkeleton, EntityDetailTabs, EntityErrorCard, EntityNotFound } from '@/components/entity'
import { EmptyState } from '@/components/states/EmptyState'
import { Badge } from '@/components/ui/badge'
import { isApiError } from '@/lib/api/errors'
import { formatDateOrDash } from '@/lib/utils/datetime'
import { AppointmentContextBlock, useTaskQuery } from '@/modules/tasks'

export const Route = createFileRoute('/_auth/tasks/$taskId/')({
  component: TaskDetailRoute,
})

function TaskDetailRoute(): ReactElement {
  const { t, i18n } = useTranslation(['patient-profile', 'tasks'])
  const { taskId } = Route.useParams()
  const query = useTaskQuery(taskId)

  if (query.isLoading) return <EntityDetailSkeleton />

  if (query.error) {
    if (isApiError(query.error) && query.error.status === 404) {
      return <EntityNotFound backTo={{ to: '/tasks' }} />
    }
    return <EntityErrorCard onRetry={() => void query.refetch()} />
  }

  const task = query.data
  if (!task) return <EntityNotFound backTo={{ to: '/tasks' }} />

  const patient = task.payload.patient
  const fullName = `${patient.family_name}, ${patient.given_name}`

  const subtitle = (
    <div className="flex flex-wrap items-center gap-2">
      {patient.insz ? (
        <Badge variant="default">
          {t('header.insz')}: <span className="ml-1 font-mono">{patient.insz}</span>
        </Badge>
      ) : (
        <Badge variant="soft">{t('header.noInsz')}</Badge>
      )}
      <span className="text-sm text-muted-foreground">
        {t('header.born', { date: formatDateOrDash(null, i18n.language) })}
      </span>
    </div>
  )

  return (
    <EntityDetailPage
      title={fullName}
      subtitle={subtitle}
      back={{ to: '/tasks' }}
      body={
        <>
          <AppointmentContextBlock task={task} />
          <EntityDetailTabs
            tabs={[
              {
                value: 'measurements',
                label: t('tasks:tabs.measurements', { defaultValue: 'Metingen' }),
                content: (
                  <EmptyState
                    icon={Activity}
                    title={t('tasks:tabs.empty.measurements.title', {
                      defaultValue: 'Nog geen metingen gekoppeld',
                    })}
                    body={t('tasks:tabs.empty.measurements.body', {
                      defaultValue: 'Wordt geleverd door de monitoring-koppeling.',
                    })}
                  />
                ),
              },
              {
                value: 'lab_results',
                label: t('tasks:tabs.lab_results', { defaultValue: 'Labresultaten' }),
                content: (
                  <EmptyState
                    icon={FlaskConical}
                    title={t('tasks:tabs.empty.lab_results.title', {
                      defaultValue: 'Nog geen labresultaten gekoppeld',
                    })}
                    body={t('tasks:tabs.empty.lab_results.body', {
                      defaultValue: 'Wordt geleverd door de HiX-koppeling.',
                    })}
                  />
                ),
              },
            ]}
          />
        </>
      }
    />
  )
}
