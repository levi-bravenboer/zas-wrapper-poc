import { ChevronRight } from 'lucide-react'
import { type ReactElement, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/style/cn'
import { formatDateOrDash } from '@/lib/utils/datetime'
import { useNotes } from '@/modules/collaboration/hooks'

import { usePatient } from '../hooks'
import type { PatientIdentifierRow } from '../types'

import { MeasurementCharts } from './MeasurementCharts'
import { PatientAppointmentsTab } from './PatientAppointmentsTab'

function pickInsz(identifiers: ReadonlyArray<PatientIdentifierRow>): string | null {
  const match = identifiers.find((id) => {
    if (id.use === 'official') return true
    const system = id.system?.toLowerCase() ?? ''
    return system.includes('ssin') || system.includes('insz') || system.includes('2.16.56')
  })
  return match?.value ?? null
}

export interface PatientOverviewTabProps {
  patientId: string
  onNavigate?: (tab: string) => void
}

export function PatientOverviewTab({
  patientId,
  onNavigate,
}: PatientOverviewTabProps): ReactElement {
  const { t, i18n } = useTranslation('patient-profile')
  const { data: patient } = usePatient(patientId)
  const insz = patient ? pickInsz(patient.identifiers ?? []) : null

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Widget title={t('overview.info')}>
        <dl className="flex flex-col gap-3">
          <Field
            label={t('overview.birthDate')}
            value={formatDateOrDash(patient?.birth_date ?? null, i18n.language)}
          />
          <Field
            label={t('overview.gender')}
            value={patient?.gender ? t(`gender.${patient.gender}`) : '—'}
          />
          <Field label={t('overview.insz')} value={insz ?? '—'} mono />
        </dl>
      </Widget>

      <Widget
        title={t('overview.notes')}
        onNavigate={onNavigate ? () => onNavigate('collaboration') : undefined}
      >
        <NotesPreview patientId={patientId} />
      </Widget>

      <Widget
        title={t('overview.appointments')}
        onNavigate={onNavigate ? () => onNavigate('appointments') : undefined}
      >
        <PatientAppointmentsTab patientId={patientId} />
      </Widget>

      <Widget
        title={t('overview.measurements')}
        className="lg:col-span-3"
        onNavigate={onNavigate ? () => onNavigate('measurements') : undefined}
      >
        <MeasurementCharts patientId={patientId} />
      </Widget>
    </div>
  )
}

function NotesPreview({ patientId }: { patientId: string }): ReactElement {
  const { t, i18n } = useTranslation('patient-profile')
  const { data } = useNotes('patient', patientId)
  const latest = [...(data ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3)

  if (latest.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('overview.notesEmpty')}</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {latest.map((note) => (
        <li key={note.id} className="flex flex-col gap-0.5 border-l-2 border-border pl-3">
          <p className="line-clamp-2 text-sm text-foreground">{note.body}</p>
          <span className="text-xs text-muted-foreground">
            {note.author_display_name} · {formatDateOrDash(note.created_at, i18n.language)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Widget({
  title,
  className,
  onNavigate,
  children,
}: {
  title: string
  className?: string
  onNavigate?: (() => void) | undefined
  children: ReactNode
}): ReactElement {
  const { t } = useTranslation('patient-profile')
  return (
    <Card className={cn('flex flex-col gap-4 p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {onNavigate ? (
          <button
            type="button"
            onClick={onNavigate}
            className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
          >
            {t('overview.viewAll')}
            <ChevronRight className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      {children}
    </Card>
  )
}

function Field({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}): ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-sm text-foreground' : 'text-sm text-foreground'}>
        {value}
      </dd>
    </div>
  )
}
