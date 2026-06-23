// surface-opt-out: app-only
import { Link, createFileRoute } from '@tanstack/react-router'
import { CalendarClock, Inbox, type LucideIcon } from 'lucide-react'
import { type ReactElement, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/states/EmptyState'
import { RowSkeleton } from '@/components/states/Skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { usePaginatedQuery } from '@/hooks/use-paginated-query'
import { formatDateTimeOrDash } from '@/lib/utils/datetime'
import { useAppointmentsQuery } from '@/modules/appointment/hooks'
import { PATIENTS_PATH } from '@/modules/patient/api'
import { TASKS_PATH } from '@/modules/tasks/keys'
import type { Task, TaskStatus } from '@/modules/tasks/types'

const PANEL_LIMIT = 5
const LOCALE = 'nl-BE'
const EM_DASH = '—'

const rowClassName =
  'flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground'

export const Route = createFileRoute('/_auth/')({
  component: HomePage,
})

function HomePage(): ReactElement {
  const { t } = useTranslation('dashboard')

  const patientsCount = usePaginatedQuery(PATIENTS_PATH, { page: 1, page_size: 1 })
  const openTasks = usePaginatedQuery<Task>(TASKS_PATH, {
    page: 1,
    page_size: PANEL_LIMIT,
    order_by: 'due_at',
    order: 'asc',
    filters: { status: { op: 'eq', value: 'open' satisfies TaskStatus } },
  })
  const appointments = useAppointmentsQuery()

  // Fixed at mount: "upcoming" is relative to when the dashboard loaded.
  const [now] = useState(() => Date.now())
  const upcoming = (appointments.data ?? [])
    .filter((a) => {
      const startsAt = new Date(a.starts_at).getTime()
      const live =
        a.status !== 'cancelled' && a.status !== 'entered_in_error' && a.status !== 'noshow'
      return live && startsAt >= now
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))

  return (
    <>
      <PageHeader title={t('title')} sub={t('sub')} />
      <div className="flex flex-col gap-6 px-6 pb-8">
        <section className="glass rounded-xl p-5">
          <header className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              {t('stats.heading')}
            </h2>
          </header>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile
              label={t('stats.patients')}
              value={patientsCount.data?.total}
              isLoading={patientsCount.isLoading}
              isError={patientsCount.isError}
            />
            <StatTile
              label={t('stats.tasks')}
              value={openTasks.data?.total}
              isLoading={openTasks.isLoading}
              isError={openTasks.isError}
            />
            <StatTile
              label={t('stats.appointments')}
              value={appointments.isError ? undefined : upcoming.length}
              isLoading={appointments.isLoading}
              isError={appointments.isError}
            />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            heading={t('tasks.heading')}
            sub={t('tasks.sub')}
            emptyIcon={Inbox}
            isLoading={openTasks.isLoading}
            isError={openTasks.isError}
            isEmpty={(openTasks.data?.items.length ?? 0) === 0}
            emptyLabel={t('tasks.empty')}
            errorLabel={t('tasks.error')}
            viewAll={
              <Link to="/tasks" className="text-xs font-medium text-primary hover:underline">
                {t('tasks.viewAll')}
              </Link>
            }
          >
            {(openTasks.data?.items ?? []).map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </Panel>

          <Panel
            heading={t('appointments.heading')}
            sub={t('appointments.sub')}
            emptyIcon={CalendarClock}
            isLoading={appointments.isLoading}
            isError={appointments.isError}
            isEmpty={upcoming.length === 0}
            emptyLabel={t('appointments.empty')}
            errorLabel={t('appointments.error')}
            viewAll={
              <Link to="/appointments" className="text-xs font-medium text-primary hover:underline">
                {t('appointments.viewAll')}
              </Link>
            }
          >
            {upcoming.slice(0, PANEL_LIMIT).map((appt) => (
              <Link
                key={appt.id}
                to="/patients/$patientId"
                params={{ patientId: appt.patient.id }}
                className={rowClassName}
              >
                <span className="truncate text-sm text-foreground">{appt.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTimeOrDash(appt.starts_at, LOCALE)}
                </span>
              </Link>
            ))}
          </Panel>
        </div>
      </div>
    </>
  )
}

function StatTile({
  label,
  value,
  isLoading,
  isError,
}: {
  label: string
  value: number | undefined
  isLoading: boolean
  isError: boolean
}): ReactElement {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/40 bg-background/40 p-4">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {isLoading ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <span className="text-2xl font-semibold tabular-nums text-foreground">
          {isError || value === undefined ? EM_DASH : value}
        </span>
      )}
    </div>
  )
}

function Panel({
  heading,
  sub,
  emptyIcon,
  isLoading,
  isError,
  isEmpty,
  emptyLabel,
  errorLabel,
  viewAll,
  children,
}: {
  heading: string
  sub: string
  emptyIcon: LucideIcon
  isLoading: boolean
  isError: boolean
  isEmpty: boolean
  emptyLabel: string
  errorLabel: string
  viewAll: ReactNode
  children: ReactNode
}): ReactElement {
  return (
    <section className="glass rounded-xl p-5">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{heading}</h2>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
        {!isLoading && !isError && !isEmpty && viewAll}
      </header>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <p className="px-1 py-6 text-center text-xs text-muted-foreground">{errorLabel}</p>
      ) : isEmpty ? (
        <EmptyState icon={emptyIcon} title={emptyLabel} />
      ) : (
        <div className="flex flex-col gap-1">{children}</div>
      )}
    </section>
  )
}

function TaskRow({ task }: { task: Task }): ReactElement {
  const due = task.due_at ? formatDateTimeOrDash(task.due_at, LOCALE) : EM_DASH
  const body = (
    <>
      <span className="truncate text-sm text-foreground">{task.title}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{due}</span>
    </>
  )
  if (task.patient_id) {
    return (
      <Link
        to="/patients/$patientId"
        params={{ patientId: task.patient_id }}
        className={rowClassName}
      >
        {body}
      </Link>
    )
  }
  return (
    <Link to="/tasks/$taskId" params={{ taskId: task.id }} className={rowClassName}>
      {body}
    </Link>
  )
}
