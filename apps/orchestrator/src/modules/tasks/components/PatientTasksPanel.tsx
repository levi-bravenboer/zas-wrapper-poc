import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Circle } from 'lucide-react'
import { useRef, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/style/cn'

import { dueLabel } from '../dueLabel'
import { usePatientTasksQuery } from '../hooks'
import type { Task } from '../types'

export type PatientTasksPanelProps = {
  patientId: string
}

function isOverdue(task: Task): boolean {
  return task.due_at != null && new Date(task.due_at).getTime() < Date.now()
}

function TaskCard({ task }: { task: Task }): ReactElement {
  const { t } = useTranslation(['tasks'])
  const overdue = isOverdue(task)
  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: task.id }}
      className="flex w-52 shrink-0 snap-start flex-col gap-2 rounded-md border border-border bg-background p-3 transition hover:border-border-strong hover:bg-surface-1"
    >
      <div className="flex items-center justify-between">
        <Circle aria-hidden className="size-4 shrink-0 text-primary" />
        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
          {t(`tasks:status.${task.status}`, { defaultValue: task.status })}
        </span>
      </div>
      <p className="line-clamp-2 text-sm leading-snug text-foreground">{task.title}</p>
      <p className={cn('text-xs', overdue ? 'text-destructive' : 'text-foreground-muted')}>
        {task.due_at ? dueLabel(t, task.due_at) : t('tasks:due.none')}
      </p>
    </Link>
  )
}

/**
 * Horizontal, snap-scrolling rail of the calling caregiver's open tasks for one
 * patient. Renders nothing (no header, no rail) while loading, on error, or
 * when there are no open tasks — by design the patient page collapses to
 * timeline-then-tabs in that case. Each card links to the existing full task
 * detail at `/tasks/$taskId`.
 */
export function PatientTasksPanel({ patientId }: PatientTasksPanelProps): ReactElement | null {
  const { t } = useTranslation(['tasks'])
  const railRef = useRef<HTMLDivElement>(null)
  const query = usePatientTasksQuery(patientId)

  const tasks = query.data?.items ?? []
  if (tasks.length === 0) return null

  const total = query.data?.total ?? tasks.length

  const scrollRail = (dir: 1 | -1): void => {
    const rail = railRef.current
    if (!rail) return
    rail.scrollBy({ left: dir * rail.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <section data-testid="patient-tasks-panel">
      <div className="mb-2 flex items-end justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t('tasks:panel.title')}</h2>
          <p className="text-xs text-foreground-muted">{t('tasks:panel.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary"
            aria-label={t('tasks:panel.count', { count: total })}
          >
            {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7"
              aria-label={t('tasks:panel.prev')}
              onClick={() => scrollRail(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7"
              aria-label={t('tasks:panel.next')}
              onClick={() => scrollRail(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={railRef}
        role="region"
        aria-label={t('tasks:panel.title')}
        className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </section>
  )
}
