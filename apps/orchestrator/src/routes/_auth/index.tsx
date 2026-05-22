// surface-opt-out: app-only
import { createFileRoute } from '@tanstack/react-router'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/layout/PageHeader'
import { RowSkeleton } from '@/components/states/Skeleton'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_auth/')({
  component: HomePage,
})

function HomePage(): ReactElement {
  const { t } = useTranslation('dashboard')

  const stats = [
    t('stats.patients'),
    t('stats.tasks'),
    t('stats.appointments'),
    t('stats.messages'),
  ] as const

  return (
    <>
      <PageHeader title={t('title')} sub={t('sub')} />
      <div className="flex flex-col gap-6 px-6 pb-8">
        <section className="glass rounded-xl p-5">
          <header className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              {t('stats.heading')}
            </h2>
          </header>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((label) => (
              <StatTile key={label} label={label} />
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <SkeletonList heading={t('tasks.heading')} sub={t('tasks.sub')} count={5} />
          <SkeletonList heading={t('patients.heading')} sub={t('patients.sub')} count={5} />
        </div>
      </div>
    </>
  )
}

function StatTile({ label }: { label: string }): ReactElement {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/40 bg-background/40 p-4">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <Skeleton className="h-7 w-16" />
    </div>
  )
}

function SkeletonList({
  heading,
  sub,
  count,
}: {
  heading: string
  sub: string
  count: number
}): ReactElement {
  return (
    <section className="glass rounded-xl p-5">
      <header className="mb-4">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{heading}</h2>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </header>
      <div className="flex flex-col gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </section>
  )
}
