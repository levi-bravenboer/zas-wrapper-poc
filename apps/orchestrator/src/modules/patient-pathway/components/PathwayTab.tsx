import { Route } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/states/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { usePatientEnrollments } from '../hooks'

import { EnrollDialog } from './EnrollDialog'
import { EnrollmentCard } from './EnrollmentCard'

export interface PathwayTabProps {
  patientId: string
}

export function PathwayTab({ patientId }: PathwayTabProps): ReactElement {
  const { t } = useTranslation('patient-pathway')
  const [enrollOpen, setEnrollOpen] = useState(false)
  const query = usePatientEnrollments(patientId)

  if (query.isLoading) {
    return <Skeleton className="h-40 w-full" />
  }

  if (query.error) {
    return <p className="text-sm text-destructive">{t('loadError')}</p>
  }

  const active = (query.data ?? []).filter((e) => e.state === 'active' || e.state === 'paused')

  return (
    <div className="flex flex-col gap-4">
      {active.length === 0 ? (
        <EmptyState
          icon={Route}
          title={t('empty.title')}
          body={t('empty.body')}
          action={<Button onClick={() => setEnrollOpen(true)}>{t('empty.enroll')}</Button>}
        />
      ) : (
        <>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setEnrollOpen(true)}>
              {t('empty.enroll')}
            </Button>
          </div>
          {active.map((enrollment) => (
            <EnrollmentCard key={enrollment.id} patientId={patientId} enrollment={enrollment} />
          ))}
        </>
      )}

      <EnrollDialog patientId={patientId} open={enrollOpen} onOpenChange={setEnrollOpen} />
    </div>
  )
}
