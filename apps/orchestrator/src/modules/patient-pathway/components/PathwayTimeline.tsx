import { Route } from 'lucide-react'
import { type ReactElement, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { usePatientEnrollments } from '../hooks'

import { EnrollDialog } from './EnrollDialog'
import { PathwayEnrollmentSummary } from './PathwayEnrollmentSummary'

export interface PathwayTimelineProps {
  patientId: string
}

export function PathwayTimeline({ patientId }: PathwayTimelineProps): ReactElement {
  const { t } = useTranslation('patient-pathway')
  const [enrollOpen, setEnrollOpen] = useState(false)
  const query = usePatientEnrollments(patientId)

  if (query.isLoading) {
    return <Skeleton className="h-28 w-full" />
  }
  if (query.error) {
    return <p className="text-sm text-destructive">{t('loadError')}</p>
  }

  const active = (query.data ?? []).filter((e) => e.state === 'active' || e.state === 'paused')

  return (
    <div className="flex flex-col gap-4">
      {active.length === 0 ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-border/60 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <Route aria-hidden className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{t('empty.title')}</span>
              <span className="text-xs text-muted-foreground">{t('empty.body')}</span>
            </div>
          </div>
          <Button size="sm" onClick={() => setEnrollOpen(true)}>
            {t('empty.enroll')}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">{t('timeline.title')}</h2>
            <Button variant="outline" size="sm" onClick={() => setEnrollOpen(true)}>
              {t('timeline.enrollAnother')}
            </Button>
          </div>
          {active.map((enrollment) => (
            <PathwayEnrollmentSummary key={enrollment.id} enrollment={enrollment} />
          ))}
        </>
      )}

      <EnrollDialog patientId={patientId} open={enrollOpen} onOpenChange={setEnrollOpen} />
    </div>
  )
}
