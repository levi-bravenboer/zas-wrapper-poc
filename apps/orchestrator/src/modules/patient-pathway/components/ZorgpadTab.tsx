import { Route } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/states/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'

import { usePatientEnrollments } from '../hooks'

import { EnrollmentCard } from './EnrollmentCard'

export interface ZorgpadTabProps {
  patientId: string
}

// Pathway tab — read-only progress (gebeurd / nu / komt) for everyone; the
// step controls inside `EnrollmentCard` are gated to admins.
export function ZorgpadTab({ patientId }: ZorgpadTabProps): ReactElement {
  const { t } = useTranslation('patient-pathway')
  const query = usePatientEnrollments(patientId)

  if (query.isLoading) {
    return <Skeleton className="h-40 w-full" />
  }
  if (query.error) {
    return <p className="text-sm text-destructive">{t('loadError')}</p>
  }

  const active = (query.data ?? []).filter((e) => e.state === 'active' || e.state === 'paused')
  if (active.length === 0) {
    return <EmptyState icon={Route} title={t('empty.title')} body={t('empty.body')} />
  }

  return (
    <div className="flex flex-col gap-4">
      {active.map((enrollment) => (
        <EnrollmentCard key={enrollment.id} patientId={patientId} enrollment={enrollment} />
      ))}
    </div>
  )
}
