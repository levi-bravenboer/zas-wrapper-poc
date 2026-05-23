import { useQueries } from '@tanstack/react-query'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTimeOrDash } from '@/lib/utils/datetime'
import { fetchUserDetail } from '@/modules/user/api'
import { userKeys } from '@/modules/user/keys'

import type { PatientRow } from '../types'

const USER_LOOKUP_STALE_MS = 5 * 60_000

export interface PatientHistoryPanelProps {
  patient: PatientRow
}

export function PatientHistoryPanel({ patient }: PatientHistoryPanelProps): ReactElement {
  const { t, i18n } = useTranslation('patient-profile')

  const userIds = Array.from(
    new Set(
      [patient.created_by, patient.updated_by, patient.deleted_by ?? null].filter(
        (v): v is string => typeof v === 'string' && v.length > 0,
      ),
    ),
  )

  const userQueries = useQueries({
    queries: userIds.map((userId) => ({
      queryKey: userKeys.detail(userId),
      queryFn: () => fetchUserDetail(userId),
      staleTime: USER_LOOKUP_STALE_MS,
    })),
  })

  const displayById = new Map<string, string>()
  userIds.forEach((id, index) => {
    const q = userQueries[index]
    const name = q?.data?.display_name
    if (typeof name === 'string' && name.length > 0) displayById.set(id, name)
  })

  const labelFor = (userId: string | null | undefined): string => {
    if (!userId) return t('history.unknownUser')
    return displayById.get(userId) ?? t('history.unknownUser')
  }

  const rows: ReadonlyArray<{ key: string; text: string }> = [
    {
      key: 'created',
      text: t('history.created', {
        date: formatDateTimeOrDash(patient.created_at, i18n.language),
        by: labelFor(patient.created_by),
      }),
    },
    {
      key: 'updated',
      text: t('history.updated', {
        date: formatDateTimeOrDash(patient.updated_at, i18n.language),
        by: labelFor(patient.updated_by),
      }),
    },
    ...(patient.deleted_at
      ? [
          {
            key: 'deleted',
            text: t('history.deleted', {
              date: formatDateTimeOrDash(patient.deleted_at, i18n.language),
              by: labelFor(patient.deleted_by),
            }),
          },
        ]
      : []),
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('history.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 text-sm text-foreground">
          {rows.map((row) => (
            <li key={row.key}>{row.text}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
