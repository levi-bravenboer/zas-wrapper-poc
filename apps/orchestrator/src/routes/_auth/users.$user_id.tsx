import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { type ReactElement, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RoleBadge } from '@/modules/user/components/RoleBadge'
import { StatusPill } from '@/modules/user/components/StatusPill'
import { formatTimestamp } from '@/modules/user/format'
import { useUserDetail } from '@/modules/user/hooks'
import type { UserDetail } from '@/modules/user/schemas'

export const Route = createFileRoute('/_auth/users/$user_id')({
  component: UserDetailPage,
})

function UserDetailPage(): ReactElement {
  const { user_id } = Route.useParams()
  const { t } = useTranslation('users')
  const { data, isLoading, error, refetch } = useUserDetail(user_id)

  const backLink = (
    <Button variant="ghost" size="sm" asChild>
      <Link to="/users">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t('detail.back')}
      </Link>
    </Button>
  )

  return (
    <>
      <PageHeader
        title={data ? data.display_name : t('detail.title')}
        sub={data?.email}
        actions={backLink}
      />
      <div className="flex flex-col gap-6 px-6 pb-8">
        {error ? (
          <ErrorState
            title={
              (error as Error & { status?: number }).status === 404
                ? t('detail.notFound')
                : t('toast.error')
            }
            onRetry={() => void refetch()}
          />
        ) : isLoading || !data ? (
          <DetailSkeleton />
        ) : (
          <DetailContent user={data} />
        )}
      </div>
    </>
  )
}

function DetailContent({ user }: { user: UserDetail }): ReactElement {
  const { t } = useTranslation('users')
  return (
    <>
      <Section title={t('detail.section.identity')}>
        <Field label={t('detail.field.display_name')}>{user.display_name}</Field>
        <Field label={t('detail.field.email')}>{user.email}</Field>
        <Field label={t('detail.field.id')}>
          <code className="font-mono text-xs">{user.id}</code>
        </Field>
      </Section>
      <Section title={t('detail.section.access')}>
        <Field label={t('detail.field.role')}>
          <RoleBadge role={user.role} />
        </Field>
        <Field label={t('detail.field.is_active')}>
          <StatusPill active={user.is_active} />
        </Field>
        <Field label={t('detail.field.external_idp')}>
          {user.external_idp ?? t('detail.empty')}
        </Field>
        <Field label={t('detail.field.external_subject')}>
          {user.external_subject ?? t('detail.empty')}
        </Field>
      </Section>
      <Section title={t('detail.section.audit')}>
        <Field label={t('detail.field.created_at')}>{formatTimestamp(user.created_at)}</Field>
        <Field label={t('detail.field.updated_at')}>{formatTimestamp(user.updated_at)}</Field>
      </Section>
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section className="rounded-xl border border-border bg-background p-5">
      <h2 className="mb-4 text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}

function DetailSkeleton(): ReactElement {
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <Skeleton className="h-4 w-32 mb-4" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

