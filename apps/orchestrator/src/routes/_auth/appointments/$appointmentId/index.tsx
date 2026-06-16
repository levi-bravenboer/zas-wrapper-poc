// surface-opt-out: app-only
import { createFileRoute, Link } from '@tanstack/react-router'
import { type ReactElement, type ReactNode } from 'react'
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
import { formatDateTimeOrDash } from '@/lib/utils/datetime'
import { useAppointmentQuery } from '@/modules/appointment/hooks'
import { AttachmentsPanel, NotesPanel } from '@/modules/collaboration/components'

export const Route = createFileRoute('/_auth/appointments/$appointmentId/')({
  component: AppointmentDetailRoute,
})

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
  const lead = appt.participants.find((p) => p.role === 'lead')

  const subtitle = (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="default">{t(`appointment:kind.${appt.kind}`, { defaultValue: appt.kind })}</Badge>
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
        <div className="flex flex-col gap-6 p-1">
          <section className="grid grid-cols-2 gap-2 text-sm">
            <Field label={t('appointment:field.patient', { defaultValue: 'Patiënt' })}>
              {patient.family_name}, {patient.given_name}
            </Field>
            <Field label={t('appointment:field.modality', { defaultValue: 'Modaliteit' })}>
              {t(`appointment:modality.${appt.modality}`, { defaultValue: appt.modality })}
            </Field>
            <Field label={t('appointment:field.lead', { defaultValue: 'Hoofdbehandelaar' })}>
              {lead?.user_display_name ?? '—'}
            </Field>
            <Field label={t('appointment:field.status', { defaultValue: 'Status' })}>
              {appt.status}
            </Field>
          </section>
          <NotesPanel ownerType="appointment" ownerId={appt.id} />
          <AttachmentsPanel ownerType="appointment" ownerId={appt.id} />
        </div>
      }
    />
  )
}

function Field({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-foreground-muted">{label}</span>
      <span className="text-foreground">{children}</span>
    </div>
  )
}
