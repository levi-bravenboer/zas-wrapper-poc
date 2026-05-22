import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateOrDash } from '@/lib/utils/datetime'

import type { OrganisationOption, PatientRow } from '../types'

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
    {
      label: t('demographics.birthDate'),
      value: formatDateOrDash(patient.birth_date, i18n.language),
    },
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
