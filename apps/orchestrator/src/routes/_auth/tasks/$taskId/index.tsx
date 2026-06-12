// surface-opt-out: app-only
import { createFileRoute } from '@tanstack/react-router'
import { Activity, FlaskConical } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import {
  EntityDetailPage,
  EntityDetailSkeleton,
  EntityDetailTabs,
  EntityErrorCard,
  EntityNotFound,
} from '@/components/entity'
import { EmptyState } from '@/components/states/EmptyState'
import { Badge } from '@/components/ui/badge'
import { isApiError } from '@/lib/api/errors'
import { formatDateOrDash } from '@/lib/utils/datetime'
import { PatientKebab } from '@/modules/patient/components/PatientKebab'
import { usePatient } from '@/modules/patient/hooks'
import { useTaskQuery } from '@/modules/tasks/hooks'
import { AppointmentContextBlock } from '@/modules/tasks/components/AppointmentContextBlock'

export const Route = createFileRoute('/_auth/tasks/$taskId/')({
  component: TaskDetailRoute,
})

function TaskDetailRoute(): ReactElement {
  const { t, i18n } = useTranslation(['patient-profile', 'tasks'])
  const { taskId } = Route.useParams()
  const taskQuery = useTaskQuery(taskId)
  // Full patient row (identifiers, birth_date, audit fields) for the header
  // subtitle + the kebab dialogs; the TaskItem payload only carries the thin
  // inline summary.
  const patientQuery = usePatient(taskQuery.data?.payload.patient.id ?? null)

  if (taskQuery.isLoading || (taskQuery.data && patientQuery.isLoading)) {
    return <EntityDetailSkeleton />
  }

  if (taskQuery.error) {
    if (isApiError(taskQuery.error) && taskQuery.error.status === 404) {
      return <EntityNotFound backTo={{ to: '/tasks' }} />
    }
    return <EntityErrorCard onRetry={() => void taskQuery.refetch()} />
  }

  if (patientQuery.error) {
    return <EntityErrorCard onRetry={() => void patientQuery.refetch()} />
  }

  const task = taskQuery.data
  if (!task) return <EntityNotFound backTo={{ to: '/tasks' }} />

  const inline = task.payload.patient
  const patient = patientQuery.data
  const fullName = `${inline.family_name}, ${inline.given_name}`

  const subtitle = (
    <div className="flex flex-wrap items-center gap-2">
      {inline.insz ? (
        <Badge variant="default">
          {t('header.insz')}: <span className="ml-1 font-mono">{inline.insz}</span>
        </Badge>
      ) : (
        <Badge variant="soft">{t('header.noInsz')}</Badge>
      )}
      <span className="text-sm text-muted-foreground">
        {t('header.born', {
          date: formatDateOrDash(patient?.birth_date ?? null, i18n.language),
        })}
      </span>
    </div>
  )

  return (
    <EntityDetailPage
      title={fullName}
      subtitle={subtitle}
      back={{ to: '/tasks' }}
      actions={patient ? <PatientKebab patient={patient} /> : undefined}
      body={
        <>
          <AppointmentContextBlock task={task} />
          <EntityDetailTabs
            tabs={[
              {
                value: 'measurements',
                label: t('tasks:tabs.measurements'),
                content: (
                  <EmptyState
                    icon={Activity}
                    title={t('tasks:tabs.empty.measurements.title')}
                    body={t('tasks:tabs.empty.measurements.body')}
                  />
                ),
              },
              {
                value: 'lab_results',
                label: t('tasks:tabs.lab_results'),
                content: (
                  <EmptyState
                    icon={FlaskConical}
                    title={t('tasks:tabs.empty.lab_results.title')}
                    body={t('tasks:tabs.empty.lab_results.body')}
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
