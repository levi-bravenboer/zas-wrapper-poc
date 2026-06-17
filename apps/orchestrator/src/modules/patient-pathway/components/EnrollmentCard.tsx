import { useQuery } from '@tanstack/react-query'
import { type ReactElement, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateOrDash } from '@/lib/utils/datetime'
import { useCan } from '@/modules/auth/permissions'
import { getPathwayVersion, listBlockTypes } from '@/modules/pathway/api'
import type { PathwayBlock } from '@/modules/pathway/types'
import {
  useCancelEnrollment,
  useCompleteStep,
  useFastForwardEnrollment,
  usePauseEnrollment,
  useResumeEnrollment,
} from '../hooks'
import type { BlockExecution, BlockExecutionState, Enrollment } from '../types'
import { bucketExecutions, type StepBucket } from '../utils/buckets'
import { DeferredValuesEditor } from './DeferredValuesEditor'
import { MdoAction } from './MdoAction'
import { deriveBlockStatus, RuntimeCanvas, RuntimeLegend } from './runtime-canvas'
import { TreatmentAction } from './TreatmentAction'

// Block kinds whose actionable step is a single "Done" with no result body.
// decision/mdo/treatment/appointment are handled with their own controls below.
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
  const cancelEnrollmentMutation = useCancelEnrollment(patientId)
  const pauseMutation = usePauseEnrollment(patientId)
  const resumeMutation = useResumeEnrollment(patientId)
  const fastForwardMutation = useFastForwardEnrollment(patientId)
  const canManage = useCan('pathway.manageRuntime')
  const canSeeSkipped = useCan('pathway.viewSkippedSteps')
  const [controlsOpen, setControlsOpen] = useState(false)

  const handleFastForward = (): void => {
    fastForwardMutation.mutate(enrollment.id, {
      onSuccess: () => toast.success(t('timeline.fastForwardToast')),
      onError: () => toast.error(t('timeline.fastForwardError')),
    })
  }

  const handleCancel = (): void => {
    cancelEnrollmentMutation.mutate(enrollment.id, {
      onSuccess: () => toast.success(t('cancel.toast.success')),
      onError: () => toast.error(t('cancel.toast.error')),
    })
  }

  const handlePause = (): void => {
    pauseMutation.mutate(enrollment.id, {
      onSuccess: () => toast.success(t('pause.toast.paused')),
      onError: () => toast.error(t('pause.toast.error')),
    })
  }

  const handleResume = (): void => {
    resumeMutation.mutate(enrollment.id, {
      onSuccess: () => toast.success(t('pause.toast.resumed')),
      onError: () => toast.error(t('pause.toast.error')),
    })
  }

  const versionQuery = useQuery({
    queryKey: ['pathway-version', enrollment.pathway_id, enrollment.pathway_version_id] as const,
    queryFn: () => getPathwayVersion(enrollment.pathway_id, enrollment.pathway_version_id),
  })

  const blockTypesQuery = useQuery({
    queryKey: ['pathway-block-types'] as const,
    queryFn: listBlockTypes,
    staleTime: Number.POSITIVE_INFINITY,
  })

  const version = versionQuery.data

  const blockById = useMemo(() => {
    const map = new Map<string, PathwayBlock>()
    for (const block of version?.blocks ?? []) map.set(block.id, block)
    return map
  }, [version])

  // Snapshot "now" once on mount so bucketing is stable across re-renders.
  const [now] = useState(() => Date.now())
  const buckets = useMemo(
    () => bucketExecutions(enrollment.executions ?? [], now),
    [enrollment.executions, now],
  )

  // Per-block runtime status for the canvas overlay (finished / active /
  // upcoming + completed meta); blocks not yet reached stay absent → dim.
  const statusByBlockId = useMemo(
    () => deriveBlockStatus(enrollment.executions ?? [], now),
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

  // Step controls — rendered only inside the admin controls dialog.
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

    if (block.kind === 'mdo') {
      return (
        <MdoAction
          disabled={completeStep.isPending}
          outcomes={block.outcomes ?? []}
          onConfirm={(result) => handleComplete(execution, { ...result })}
        />
      )
    }

    if (block.kind === 'treatment') {
      return (
        <TreatmentAction
          disabled={completeStep.isPending}
          onConfirm={(result) => handleComplete(execution, { ...result })}
        />
      )
    }

    // Appointment completion is an opaque event (no typed result).
    if (block.kind === 'appointment') {
      return (
        <Button
          size="sm"
          disabled={completeStep.isPending}
          onClick={() => handleComplete(execution)}
        >
          {t('step.appointment.perform')}
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
        {canManage ? (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => setControlsOpen(true)}
          >
            {t('timeline.manage')}
          </Button>
        ) : null}
      </div>

      <RuntimeLegend />
      {version && versionQuery.isSuccess && blockTypesQuery.isSuccess ? (
        <RuntimeCanvas
          blocks={version.blocks ?? []}
          phases={version.phases ?? []}
          edges={version.edges ?? []}
          timingValues={version.timing_values ?? []}
          blockTypes={blockTypesQuery.data}
          statusByBlockId={statusByBlockId}
          showSkipped={canSeeSkipped}
        />
      ) : (
        <Skeleton className="h-[460px] w-full" />
      )}

      {canManage ? (
        <Dialog open={controlsOpen} onOpenChange={setControlsOpen}>
          <DialogContent className="grid-rows-[auto_minmax(0,1fr)] sm:max-w-lg max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>{t('timeline.controlsTitle')}</DialogTitle>
            </DialogHeader>
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-1">
              <div className="flex flex-wrap gap-2">
                {enrollment.state === 'active' ? (
                  <Button
                    variant="default"
                    size="sm"
                    disabled={fastForwardMutation.isPending}
                    onClick={handleFastForward}
                  >
                    {t('timeline.fastForward')}
                  </Button>
                ) : null}
                {enrollment.state === 'active' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pauseMutation.isPending}
                    onClick={handlePause}
                  >
                    {t('pause.pause')}
                  </Button>
                ) : null}
                {enrollment.state === 'paused' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resumeMutation.isPending}
                    onClick={handleResume}
                  >
                    {t('pause.resume')}
                  </Button>
                ) : null}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={cancelEnrollmentMutation.isPending}
                    >
                      {t('cancel.action')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('cancel.title')}</AlertDialogTitle>
                      <AlertDialogDescription>{t('cancel.description')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('cancel.dismiss')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancel}>
                        {t('cancel.confirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <DeferredValuesEditor patientId={patientId} enrollment={enrollment} />

              <BucketSection
                bucket="next"
                executions={buckets.next}
                blockName={blockName}
                language={i18n.language}
                renderAction={renderAction}
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </Card>
  )
}

interface BucketSectionProps {
  bucket: StepBucket
  executions: BlockExecution[]
  blockName: (execution: BlockExecution) => string
  language: string
  renderAction: (bucket: StepBucket, execution: BlockExecution) => ReactElement | null
  renderExtra?: (execution: BlockExecution) => ReactElement | null
}

function BucketSection({
  bucket,
  executions,
  blockName,
  language,
  renderAction,
  renderExtra,
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
              extra={renderExtra?.(execution) ?? null}
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
  extra: ReactElement | null
}

function StepRow({ bucket, execution, name, language, action, extra }: StepRowProps): ReactElement {
  const muted = bucket === 'upcoming'

  return (
    <li className={`flex flex-col gap-3 rounded-md border p-3 ${muted ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{name}</span>
          <StepMeta bucket={bucket} execution={execution} language={language} />
        </div>
        <div className="flex items-center gap-2">
          {action}
          <StateBadge state={execution.state} />
        </div>
      </div>
      {extra}
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
        {execution.completed_by_name ? ` · ${execution.completed_by_name}` : null}
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
