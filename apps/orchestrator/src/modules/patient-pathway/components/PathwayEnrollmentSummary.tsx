import { useQuery } from '@tanstack/react-query'
import { type ReactElement, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateOrDash } from '@/lib/utils/datetime'
import { getPathwayVersion, listBlockTypes } from '@/modules/pathway/api'

import { deriveSummary, type SummaryStep, windowAround } from '../summary'
import type { Enrollment } from '../types'

import { PathwaySummaryHeader } from './PathwaySummaryHeader'
import { PathwayTrailNode } from './PathwayTrailNode'
import { PathwayTrailOverflow } from './PathwayTrailOverflow'
import { RuntimeLegend } from './runtime-canvas'

const WINDOW = 2

const DAY_MS = 86_400_000

export interface PathwayEnrollmentSummaryProps {
  enrollment: Enrollment
}

// Compact glance banner for one active enrollment: header (status · anchor ·
// phase · X/N + meter), a bounded trail window around the current step, and a
// state legend mirroring the detail tab's runtime canvas. Read-only summary;
// the full graph + controls live in the Zorgpad detail tab.
export function PathwayEnrollmentSummary({
  enrollment,
}: PathwayEnrollmentSummaryProps): ReactElement {
  const { t } = useTranslation('patient-pathway')
  const { t: tp, i18n } = useTranslation('pathway')

  const versionQuery = useQuery({
    queryKey: ['pathway-version', enrollment.pathway_id, enrollment.pathway_version_id] as const,
    queryFn: () => getPathwayVersion(enrollment.pathway_id, enrollment.pathway_version_id),
  })
  const blockTypesQuery = useQuery({
    queryKey: ['pathway-block-types'] as const,
    queryFn: listBlockTypes,
    staleTime: Number.POSITIVE_INFINITY,
  })

  const [now] = useState(() => Date.now())
  const version = versionQuery.data
  const blockTypes = blockTypesQuery.data

  const summary = useMemo(() => {
    if (!version || !blockTypes) return null
    return deriveSummary({
      executions: enrollment.executions ?? [],
      blocks: version.blocks ?? [],
      phases: version.phases ?? [],
      blockTypes,
      now,
    })
  }, [version, blockTypes, enrollment.executions, now])

  const stepSub = (step: SummaryStep): string | null => {
    const typeLabel = tp(`blockType.${step.legacyType}`, { defaultValue: step.legacyType })
    if (step.state === 'finished') {
      const date = step.completedAt ? formatDateOrDash(step.completedAt, i18n.language) : null
      const parts = [date, step.completedByName].filter(Boolean)
      return parts.length > 0 ? parts.join(' · ') : typeLabel
    }
    if (step.state === 'active') {
      if (step.overdue && step.dueAt) {
        const days = Math.max(1, Math.floor((now - new Date(step.dueAt).getTime()) / DAY_MS))
        return t('summary.overdueDays', { count: days })
      }
      return typeLabel
    }
    return step.scheduledAt ? formatDateOrDash(step.scheduledAt, i18n.language) : typeLabel
  }

  if (versionQuery.isLoading || blockTypesQuery.isLoading || !summary) {
    return (
      <Card className="p-4">
        <Skeleton className="h-24 w-full" />
      </Card>
    )
  }

  const { steps, nowIndex } = summary
  const { cells, beforeHidden, afterHidden } = windowAround(steps, nowIndex, WINDOW)

  return (
    <Card className="flex flex-col gap-3 p-4">
      <PathwaySummaryHeader
        state={enrollment.state}
        anchorDate={enrollment.anchor_date}
        phaseName={summary.phaseName}
        done={summary.done}
        total={summary.total}
      />

      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('timeline.noSteps')}</p>
      ) : (
        <ol className="mt-1 flex items-start">
          {beforeHidden > 0 ? (
            <PathwayTrailOverflow
              count={beforeHidden}
              label={t('summary.done')}
              leftOn
              rightOn
              leftHide
              rightHide={false}
            />
          ) : null}
          {cells.map((cell, ci) => {
            const isFirstCell = ci === 0 && beforeHidden === 0
            const isLastCell = ci === cells.length - 1 && afterHidden === 0
            return (
              <PathwayTrailNode
                key={cell.step.id}
                name={cell.step.name}
                state={cell.step.state}
                icon={cell.step.icon}
                sub={stepSub(cell.step)}
                overdue={cell.step.overdue}
                leftOn={cell.index <= nowIndex && nowIndex >= 0}
                rightOn={cell.index < nowIndex && nowIndex >= 0}
                leftHide={isFirstCell}
                rightHide={isLastCell}
              />
            )
          })}
          {afterHidden > 0 ? (
            <PathwayTrailOverflow
              count={afterHidden}
              label={t('summary.toGo')}
              leftOn={false}
              rightOn={false}
              leftHide={false}
              rightHide
            />
          ) : null}
        </ol>
      )}

      <div className="border-t border-border pt-2.5">
        <RuntimeLegend />
      </div>
    </Card>
  )
}
