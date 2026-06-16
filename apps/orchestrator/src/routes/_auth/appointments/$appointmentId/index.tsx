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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { isApiError } from '@/lib/api/errors'
import { formatDateTimeOrDash } from '@/lib/utils/datetime'
import { initials } from '@/lib/utils/initials'
import { useAppointmentQuery } from '@/modules/appointment/hooks'
import { CollaborationColumn } from '@/modules/collaboration/components'

export const Route = createFileRoute('/_auth/appointments/$appointmentId/')({
  component: AppointmentDetailRoute,
})

const timeFmt = new Intl.DateTimeFormat('nl-BE', { hour: '2-digit', minute: '2-digit' })

function AppointmentDetailRoute(): ReactElement {
  const { t } = useTranslation(['appointment'])
  const { appointmentId } = Route.useParams()
  const query = useAppointmentQuery(appointmentId)

  if (query.isLoading) return <EntityDetailSkeleton />
  if (query.error) {
    if (isApiError(query.error) && query.error.status === 404) {
      return <EntityNotFound backTo={{ to: '/appointments' }} />
    }
    return <EntityErrorCard onRetry={() => void query.refetch()} />
  }

  const appt = query.data
  if (!appt) return <EntityNotFound backTo={{ to: '/appointments' }} />

  const patient = appt.patient
  const when = `${formatDateTimeOrDash(appt.starts_at, 'nl')} – ${timeFmt.format(new Date(appt.ends_at))}`

  const subtitle = (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="default">
        {t(`appointment:kind.${appt.kind}`, { defaultValue: appt.kind })}
      </Badge>
      <span className="text-sm text-muted-foreground">
        {formatDateTimeOrDash(appt.starts_at, 'nl')}
        {appt.location_text ? ` · ${appt.location_text}` : ''}
      </span>
    </div>
  )

  return (
    <EntityDetailPage
      title={appt.title}
      subtitle={subtitle}
      back={{ to: '/appointments' }}
      actions={
        <Button asChild variant="outline">
          <Link to="/patients/$patientId" params={{ patientId: patient.id }}>
            {t('appointment:openPatient', { defaultValue: 'Open patiënt' })}
          </Link>
        </Button>
      }
      body={
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(260px,320px)_1fr]">
          <DetailCard title={t('appointment:detail.title', { defaultValue: 'Details' })}>
            {appt.description ? (
              <DetailRow label={t('appointment:field.description', { defaultValue: 'Omschrijving' })}>
                <span className="whitespace-pre-wrap">{appt.description}</span>
              </DetailRow>
            ) : null}
            <DetailRow label={t('appointment:field.when', { defaultValue: 'Wanneer' })}>
              {when}
            </DetailRow>
            <DetailRow label={t('appointment:field.modality', { defaultValue: 'Modaliteit' })}>
              {t(`appointment:modality.${appt.modality}`, { defaultValue: appt.modality })}
              {appt.location_text ? ` · ${appt.location_text}` : ''}
            </DetailRow>
            <DetailRow label={t('appointment:field.patient', { defaultValue: 'Patiënt' })}>
              <Link
                to="/patients/$patientId"
                params={{ patientId: patient.id }}
                className="font-medium text-primary hover:underline"
              >
                {patient.family_name}, {patient.given_name}
              </Link>
            </DetailRow>
            <DetailRow label={t('appointment:field.participants', { defaultValue: 'Deelnemers' })}>
              <ul className="flex flex-col gap-2">
                {appt.participants.map((p) => (
                  <li key={p.user_id} className="flex items-center gap-2">
                    <Avatar size="sm" tintBy={p.user_id}>
                      <AvatarFallback tinted>{initials(p.user_display_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-foreground">{p.user_display_name}</span>
                      <span className="text-[11px] text-foreground-muted">
                        {t(`appointment:role.${p.role}`, { defaultValue: p.role })}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </DetailRow>
            <DetailRow label={t('appointment:field.status', { defaultValue: 'Status' })}>
              <Badge variant="soft">
                {t(`appointment:status.${appt.status}`, { defaultValue: appt.status })}
              </Badge>
            </DetailRow>
          </DetailCard>

          <CollaborationColumn ownerType="appointment" ownerId={appt.id} />
        </div>
      }
    />
  )
}
