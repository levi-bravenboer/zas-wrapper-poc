import { Link } from '@tanstack/react-router'
import { Calendar } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/states/EmptyState'
import { formatDateTimeOrDash } from '@/lib/utils/datetime'
import { usePatientAppointmentsQuery } from '@/modules/appointment/hooks'
import type { PatientAppointmentEntry } from '@/modules/appointment/types'

function Group({
  label,
  entries,
}: {
  label: string
  entries: PatientAppointmentEntry[]
}): ReactElement | null {
  if (entries.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs uppercase tracking-wider text-foreground-muted">{label}</h3>
      <ul className="flex flex-col gap-1">
        {entries.map(({ appointment }) => (
          <li key={appointment.id}>
            <Link
              to="/appointments/$appointmentId"
              params={{ appointmentId: appointment.id }}
              className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-surface-1"
            >
              <span className="truncate font-medium text-foreground">{appointment.title}</span>
              <span className="shrink-0 text-xs tabular-nums text-foreground-muted">
                {formatDateTimeOrDash(appointment.starts_at, 'nl')}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function PatientAppointmentsTab({ patientId }: { patientId: string }): ReactElement {
  const { t } = useTranslation(['patient-profile'])
  const query = usePatientAppointmentsQuery(patientId)

  if (query.isError) {
    return (
      <EmptyState
        icon={Calendar}
        title={t('tabs.empty.appointments.title')}
        body={t('tabs.empty.appointments.body')}
      />
    )
  }

  const entries = query.data ?? []
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title={t('tabs.empty.appointments.title')}
        body={t('tabs.empty.appointments.body')}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Group
        label={t('tabs.appointments.about')}
        entries={entries.filter((e) => e.relation === 'about')}
      />
      <Group
        label={t('tabs.appointments.with')}
        entries={entries.filter((e) => e.relation === 'with')}
      />
    </div>
  )
}
