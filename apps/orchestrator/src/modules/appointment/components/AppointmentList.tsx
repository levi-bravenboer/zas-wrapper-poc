import { Link, useParams } from '@tanstack/react-router'
import { Activity, Calendar, FlaskConical, Inbox, ScanLine, Stethoscope } from 'lucide-react'
import { type ComponentType, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { GroupedList, GroupedListSection, RailRow } from '@/components/rail'
import { EmptyState } from '@/components/states/EmptyState'
import { RowSkeleton } from '@/components/states/Skeleton'
import { intlLocale } from '@/lib/i18n'
import { groupConsecutiveByDay } from '@/lib/utils/grouping'

import { useAppointmentsQuery } from '../hooks'
import type { AppointmentKind } from '../types'

const KIND_ICON: Record<AppointmentKind, ComponentType<{ className?: string }>> = {
  consultation: Stethoscope,
  lab: FlaskConical,
  imaging: ScanLine,
  procedure: Activity,
  other: Calendar,
}

const dayFmt = (): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(intlLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
const timeFmt = (): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' })

function AppointmentListBody({ selectedId }: { selectedId: string | undefined }): ReactElement {
  const { t } = useTranslation(['appointment'])
  const query = useAppointmentsQuery()

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-2 p-3" aria-busy data-testid="appointment-list-loading">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    )
  }
  if (query.isError) {
    return (
      <EmptyState
        icon={Inbox}
        title={t('appointment:error.title')}
        body={t('appointment:error.body')}
      />
    )
  }

  const groups = groupConsecutiveByDay(query.data ?? [], (appt) => appt.starts_at)
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title={t('appointment:empty.title')}
        body={t('appointment:empty.body')}
      />
    )
  }

  return (
    <GroupedList>
      {groups.map((group) => {
        const first = group.items[0]
        return (
          <GroupedListSection
            key={group.key}
            label={first ? dayFmt().format(new Date(first.starts_at)) : ''}
          >
            {group.items.map((appt) => {
              const KindIcon = KIND_ICON[appt.kind] ?? Calendar
              const secondary = [timeFmt().format(new Date(appt.starts_at)), appt.location_text]
                .filter(Boolean)
                .join(' · ')
              return (
                <RailRow
                  key={appt.id}
                  selected={selectedId === appt.id}
                  leading={
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-2">
                      <KindIcon className="size-4 text-foreground-muted" />
                    </span>
                  }
                  primary={`${appt.patient.family_name}, ${appt.patient.given_name}`}
                  secondary={secondary}
                  render={({ content, className }) => (
                    <Link
                      to="/appointments/$appointmentId"
                      params={{ appointmentId: appt.id }}
                      className={className}
                    >
                      {content}
                    </Link>
                  )}
                />
              )
            })}
          </GroupedListSection>
        )
      })}
    </GroupedList>
  )
}

export function AppointmentList(): ReactElement {
  const { t } = useTranslation(['appointment'])
  const params = useParams({ strict: false })
  const selectedId = (params as { appointmentId?: string }).appointmentId

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="appointment-list">
      <header className="border-b border-border/60 px-4 py-4">
        <h1 className="text-lg font-semibold text-foreground">{t('appointment:title')}</h1>
        <p className="text-xs text-foreground-muted">{t('appointment:subtitle')}</p>
      </header>
      <div className="flex-1 overflow-y-auto">
        <AppointmentListBody selectedId={selectedId} />
      </div>
    </div>
  )
}
