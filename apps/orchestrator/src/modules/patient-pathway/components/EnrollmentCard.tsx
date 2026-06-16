import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDateOrDash } from '@/lib/utils/datetime'
import { getPathwayVersion } from '@/modules/pathway/api'
import type { PathwayBlock } from '@/modules/pathway/types'

import { useCompleteStep } from '../hooks'
import type { BlockExecution, BlockExecutionState, Enrollment } from '../types'
import { bucketExecutions, type StepBucket } from '../utils/buckets'

// Block kinds whose actionable step is a single "Done" with no result body.
// Decision is handled separately (outcome picker). Appointment/treatment/mdo
// contracts are not wired yet.
const DONE_ONLY_KINDS = new Set(['task'])

const STATE_BADGE_VARIANT: Record<string, 'default' | 'soft' | 'outline'> = {
  active: 'default',
  eligible: 'outline',
  completed: 'soft',
  skipped: 'soft',
  failed: 'outline',
}

export interface EnrollmentCardProps {
  patientId: string
  enrollment: Enrollment
}

export function EnrollmentCard({ patientId, enrollment }: EnrollmentCardProps): ReactElement {
  const { t, i18n } = useTranslation('patient-pathway')
  const completeStep = useCompleteStep(patientId)

  const versionQuery = useQuery({
    queryKey: ['pathway-version', enrollment.pathway_id, enrollment.pathway_version_id] as const,
    queryFn: () => getPathwayVersion(enrollment.pathway_id, enrollment.pathway_version_id),
  })

  const blockById = useMemo(() => {
    const map = new Map<string, PathwayBlock>()
    for (const block of versionQuery.data?.blocks ?? []) map.set(block.id, block)
    return map
  }, [versionQuery.data])

  // Snapshot "now" once on mount so bucketing is stable across re-renders.
  const [now] = useState(() => Date.now())
  const buckets = useMemo(
    () => bucketExecutions(enrollment.executions ?? [], now),
    [enrollment.executions, now],
  )

  const blockName = (execution: BlockExecution): string =>
    blockById.get(execution.block_template_id)?.name ?? t('step.unknownBlock')

  const handleComplete = (execution: BlockExecution, result?: Record<string, unknown>): void => {
    completeStep.mutate(
      { enrollmentId: enrollment.id, execution, result: result ?? null },
      {
        onSuccess: () => toast.success(t('step.doneToast.success')),
        onError: () => toast.error(t('step.doneToast.error')),
      },
    )
  }

  const renderAction = (bucket: StepBucket, execution: BlockExecution): ReactElement | null => {
    if (bucket !== 'next') return null
    const block = blockById.get(execution.block_template_id)
    if (!block) return null

    if (DONE_ONLY_KINDS.has(block.kind)) {
      return (
        <Button
          size="sm"
          disabled={completeStep.isPending}
          onClick={() => handleComplete(execution)}
        >
          {t('step.done')}
        </Button>
      )
    }

    // Decision blocks with an `auto_resolve` settle from an upstream field — no
    // manual pick. Only outputs-bearing, non-auto-resolved decisions are
    // caregiver-actionable here.
    if (block.kind === 'decision' && !block.auto_resolve && (block.outputs?.length ?? 0) > 0) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {block.outputs?.map((output) => (
            <Button
              key={output}
              size="sm"
              variant="outline"
              disabled={completeStep.isPending}
              onClick={() => handleComplete(execution, { output_key: output })}
            >
              {output}
            </Button>
          ))}
        </div>
      )
    }

    return null
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Badge variant="soft">{t(`card.state.${enrollment.state}`)}</Badge>
        <span className="text-sm text-muted-foreground">
          {t('card.anchor')}: {formatDateOrDash(enrollment.anchor_date, i18n.language)}
        </span>
      </div>

      <BucketSection
        bucket="next"
        executions={buckets.next}
        blockName={blockName}
        language={i18n.language}
        renderAction={renderAction}
      />
      <BucketSection
        bucket="upcoming"
        executions={buckets.upcoming}
        blockName={blockName}
        language={i18n.language}
        renderAction={renderAction}
      />
      <BucketSection
        bucket="finished"
        executions={buckets.finished}
        blockName={blockName}
        language={i18n.language}
        renderAction={renderAction}
      />
    </Card>
  )
}

interface BucketSectionProps {
  bucket: StepBucket
  executions: BlockExecution[]
  blockName: (execution: BlockExecution) => string
  language: string
  renderAction: (bucket: StepBucket, execution: BlockExecution) => ReactElement | null
}

function BucketSection({
  bucket,
  executions,
  blockName,
  language,
  renderAction,
}: BucketSectionProps): ReactElement {
  const { t } = useTranslation('patient-pathway')
  const emptyKey = {
    upcoming: 'buckets.emptyUpcoming',
    next: 'buckets.emptyNext',
    finished: 'buckets.emptyFinished',
  }[bucket]

  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t(`buckets.${bucket}`)}
      </h4>
      {executions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(emptyKey)}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {executions.map((execution) => (
            <StepRow
              key={execution.id}
              bucket={bucket}
              execution={execution}
              name={blockName(execution)}
              language={language}
              action={renderAction(bucket, execution)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

interface StepRowProps {
  bucket: StepBucket
  execution: BlockExecution
  name: string
  language: string
  action: ReactElement | null
}

function StepRow({ bucket, execution, name, language, action }: StepRowProps): ReactElement {
  const muted = bucket === 'upcoming'

  return (
    <li
      className={`flex items-start justify-between gap-3 rounded-md border p-3 ${
        muted ? 'opacity-60' : ''
      }`}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{name}</span>
        <StepMeta bucket={bucket} execution={execution} language={language} />
      </div>
      <div className="flex items-center gap-2">
        {action}
        <StateBadge state={execution.state} />
      </div>
    </li>
  )
}

function StepMeta({
  bucket,
  execution,
  language,
}: {
  bucket: StepBucket
  execution: BlockExecution
  language: string
}): ReactElement | null {
  const { t } = useTranslation('patient-pathway')

  if (bucket === 'upcoming' && execution.scheduled_at) {
    return (
      <span className="text-xs text-muted-foreground">
        {t('step.readyOn', { date: formatDateOrDash(execution.scheduled_at, language) })}
      </span>
    )
  }

  if (bucket === 'finished') {
    const summary = finishedSummary(execution)
    return (
      <span className="text-xs text-muted-foreground">
        {execution.completed_at
          ? t('step.completedOn', { date: formatDateOrDash(execution.completed_at, language) })
          : null}
        {summary ? ` · ${summary}` : null}
      </span>
    )
  }

  return null
}

function finishedSummary(execution: BlockExecution): string | null {
  if (execution.decision_output) return execution.decision_output
  if (execution.result_json && Object.keys(execution.result_json).length > 0) {
    return Object.entries(execution.result_json)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(', ')
  }
  return null
}

function StateBadge({ state }: { state: BlockExecutionState }): ReactElement {
  const { t } = useTranslation('patient-pathway')
  const variant = STATE_BADGE_VARIANT[state] ?? 'outline'
  return <Badge variant={variant}>{t(`step.stateBadge.${state}`, { defaultValue: state })}</Badge>
}
