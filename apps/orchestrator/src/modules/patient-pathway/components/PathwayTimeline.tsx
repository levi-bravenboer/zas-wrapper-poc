import { useQuery } from '@tanstack/react-query'
import { Check, Route } from 'lucide-react'
import { type ReactElement, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/style/cn'
import { formatDateOrDash } from '@/lib/utils/datetime'
import { getPathwayVersion } from '@/modules/pathway/api'
import type { PathwayBlock } from '@/modules/pathway/types'

import { usePatientEnrollments } from '../hooks'
import type { BlockExecution, Enrollment } from '../types'
import { bucketExecutions, type StepBucket } from '../utils/buckets'

import { EnrollDialog } from './EnrollDialog'

export interface PathwayTimelineProps {
  patientId: string
}

export function PathwayTimeline({ patientId }: PathwayTimelineProps): ReactElement {
  const { t, i18n } = useTranslation('patient-pathway')
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
            <Card key={enrollment.id} className="flex flex-col gap-4 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="soft">{t(`card.state.${enrollment.state}`)}</Badge>
                <span className="text-sm text-muted-foreground">
                  {t('card.anchor')}: {formatDateOrDash(enrollment.anchor_date, i18n.language)}
                </span>
              </div>
              <PathwayProgress enrollment={enrollment} />
            </Card>
          ))}
        </>
      )}

      <EnrollDialog patientId={patientId} open={enrollOpen} onOpenChange={setEnrollOpen} />
    </div>
  )
}

interface OrderedStep {
  execution: BlockExecution
  bucket: StepBucket
}

function PathwayProgress({ enrollment }: { enrollment: Enrollment }): ReactElement {
  const { t } = useTranslation('patient-pathway')
  const versionQuery = useQuery({
    queryKey: ['pathway-version', enrollment.pathway_id, enrollment.pathway_version_id] as const,
    queryFn: () => getPathwayVersion(enrollment.pathway_id, enrollment.pathway_version_id),
  })

  const blockById = useMemo(() => {
    const map = new Map<string, PathwayBlock>()
    for (const block of versionQuery.data?.blocks ?? []) map.set(block.id, block)
    return map
  }, [versionQuery.data])

  const [now] = useState(() => Date.now())
  const steps = useMemo<OrderedStep[]>(() => {
    const buckets = bucketExecutions(enrollment.executions ?? [], now)
    return [
      ...buckets.finished.map((execution) => ({ execution, bucket: 'finished' as const })),
      ...buckets.next.map((execution) => ({ execution, bucket: 'next' as const })),
      ...buckets.upcoming.map((execution) => ({ execution, bucket: 'upcoming' as const })),
    ]
  }, [enrollment.executions, now])

  if (steps.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('timeline.noSteps')}</p>
  }

  const last = steps.length - 1
  return (
    <ol className="flex items-start gap-0 overflow-x-auto pb-1">
      {steps.map(({ execution, bucket }, idx) => {
        const finished = bucket === 'finished'
        const current = bucket === 'next'
        const name = blockById.get(execution.block_template_id)?.name ?? t('step.unknownBlock')
        return (
          <li
            key={execution.id}
            className="flex min-w-[6rem] shrink-0 grow basis-[6rem] flex-col items-center gap-1.5"
          >
            <div className="flex w-full items-center">
              <span
                className={cn(
                  'h-0.5 flex-1 rounded-full',
                  idx === 0 ? 'opacity-0' : finished || current ? 'bg-primary' : 'bg-border',
                )}
              />
              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full border text-xs font-medium',
                  current && 'border-primary bg-primary text-primary-foreground shadow-sm',
                  finished && 'border-primary bg-primary/10 text-primary',
                  !current && !finished && 'border-border bg-background text-muted-foreground',
                )}
              >
                {finished ? <Check className="size-4" aria-hidden /> : idx + 1}
              </span>
              <span
                className={cn(
                  'h-0.5 flex-1 rounded-full',
                  idx === last ? 'opacity-0' : finished ? 'bg-primary' : 'bg-border',
                )}
              />
            </div>
            <span
              title={name}
              className={cn(
                'max-w-full truncate px-0.5 text-center text-[11px] leading-tight',
                current ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {name}
            </span>
            <Badge variant={current ? 'default' : 'soft'} className="text-[10px]">
              {t(`timeline.state.${bucket}`)}
            </Badge>
          </li>
        )
      })}
    </ol>
  )
}
