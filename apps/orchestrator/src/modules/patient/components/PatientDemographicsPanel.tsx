import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import type { OrganisationOption, PatientRow } from '../types'

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export interface PatientDemographicsPanelProps {
  patient: PatientRow
  organisation: OrganisationOption | undefined
}

export function PatientDemographicsPanel({
  patient,
  organisation,
}: PatientDemographicsPanelProps): ReactElement {
  const { t, i18n } = useTranslation('patient-profile')

  const rows: ReadonlyArray<{ label: string; value: string }> = [
    { label: t('demographics.name'), value: `${patient.family_name}, ${patient.given_name}` },
    { label: t('demographics.birthDate'), value: formatDate(patient.birth_date, i18n.language) },
    { label: t('demographics.gender'), value: t(`gender.${patient.gender}`) },
    {
      label: t('demographics.primaryOrg'),
      value: organisation?.name ?? t('header.unknownOrg'),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('demographics.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {row.label}
              </dt>
              <dd className="text-sm text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
