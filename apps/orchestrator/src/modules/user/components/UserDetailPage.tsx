import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { AtSign, Pencil, UserMinus } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  EntityDetailPage,
  EntityDetailSingleColumn,
  EntityDetailSkeleton,
  EntityErrorCard,
  EntityNotFound,
} from '@/components/entity'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api/client'
import type { components } from '@/lib/api/schema'
import { initials } from '@/lib/utils/initials'
import { useSession } from '@/modules/auth/hooks'

import { formatTimestamp } from '../format'
import { useSetUserActive, useUserDetail } from '../hooks'
import type { Role, UserDetail } from '../schemas'

import { RoleBadge } from './RoleBadge'
import { StatusPill } from './StatusPill'

type PractitionerRead = components['schemas']['PractitionerRead']
type PractitionerRoleRead = components['schemas']['PractitionerRoleRead']

async function fetchPractitioner(userId: string): Promise<PractitionerRead | null> {
  const { data, response } = await api.GET('/practitioners/{user_id}', {
    params: { path: { user_id: userId } },
  })
  if (response.status === 404) return null
  if (!response.ok || !data) {
    throw new Error(`Practitioner fetch failed (${response.status})`)
  }
  return data
}

export interface UserDetailPageProps {
  userId: string
}

export function UserDetailPage({ userId }: UserDetailPageProps): ReactElement {
  const { t } = useTranslation('users-admin-ui')
  const session = useSession()
  const userQuery = useUserDetail(userId)
  const setActive = useSetUserActive()
  const practitionerQuery = useQuery({
    queryKey: ['practitioner', userId],
    queryFn: () => fetchPractitioner(userId),
    enabled: userQuery.data?.role === 'caregiver',
    staleTime: 30_000,
  })

  if (userQuery.isLoading) {
    return <EntityDetailSkeleton />
  }

  if (userQuery.error) {
    const status = (userQuery.error as { status?: number } | null)?.status
    if (status === 404) {
      return <EntityNotFound backTo={{ to: '/admin/users' }} />
    }
    return <EntityErrorCard onRetry={() => void userQuery.refetch()} />
  }

  if (!userQuery.data) {
    return <EntityNotFound backTo={{ to: '/admin/users' }} />
  }

  const user = userQuery.data
  const practitioner = practitionerQuery.data ?? null
  const showPractitioner = user.role === 'caregiver' && practitioner !== null
  const isSelf = user.id === (session.data?.id ?? '')

  return (
    <EntityDetailPage
      title={user.display_name}
      subtitle={
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <RoleBadge role={user.role as Role} withIcon />
          <span>{user.email}</span>
        </span>
      }
      back={{ to: '/admin/users' }}
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/users/$userId/edit" params={{ userId: user.id }}>
              <Pencil className="size-4" aria-hidden />
              {t('detail.action.edit')}
            </Link>
          </Button>
          <Button
            variant="danger"
            disabled={isSelf || !user.is_active || setActive.isPending}
            onClick={() => {
              setActive.mutate(
                { userId: user.id, is_active: false },
                {
                  onSuccess: () => toast.success(t('toast.deactivated')),
                  onError: () => toast.error(t('toast.error')),
                },
              )
            }}
          >
            <UserMinus className="size-4" aria-hidden />
            {t('detail.action.deactivate')}
          </Button>
        </div>
      }
      body={
        <EntityDetailSingleColumn>
          <UserHero user={user} />
          <DemographicsBlock user={user} />
          {showPractitioner ? <PractitionerBlock practitioner={practitioner} /> : null}
        </EntityDetailSingleColumn>
      }
    />
  )
}

function UserHero({ user }: { user: UserDetail }): ReactElement {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/5 via-background to-background p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative flex items-center gap-5">
        <Avatar size="lg" className="size-16 ring-4 ring-background shadow-sm">
          <AvatarFallback className="text-lg">{initials(user.display_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-xl font-semibold tracking-tight">{user.display_name}</h2>
            <RoleBadge role={user.role as Role} withIcon />
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
            <AtSign className="size-3.5" aria-hidden />
            <span className="truncate">{user.email}</span>
          </p>
        </div>
        <StatusPill active={user.is_active} />
      </div>
    </div>
  )
}

function DemographicsBlock({ user }: { user: UserDetail }): ReactElement {
  const { t } = useTranslation('users-admin-ui')
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">
        {t('detail.card.demographics.title')}
      </h3>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Field label={t('detail.card.demographics.field.display_name')} value={user.display_name} />
        <Field label={t('detail.card.demographics.field.email')} value={user.email} />
        <Field
          label={t('detail.card.demographics.field.role')}
          value={<RoleBadge role={user.role as Role} />}
        />
        <Field
          label={t('detail.card.demographics.field.is_active')}
          value={<StatusPill active={user.is_active} />}
        />
        <Field
          label={t('detail.card.demographics.field.created_at')}
          value={formatTimestamp(user.created_at)}
        />
      </dl>
    </section>
  )
}

function PractitionerBlock({ practitioner }: { practitioner: PractitionerRead }): ReactElement {
  const { t } = useTranslation('users-admin-ui')
  const sorted: PractitionerRoleRead[] = [...practitioner.roles].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
    return b.period_start.localeCompare(a.period_start)
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('detail.card.practitioner.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <Field
            label={t('detail.card.practitioner.field.family_name')}
            value={practitioner.family_name}
          />
          <Field
            label={t('detail.card.practitioner.field.given_name')}
            value={practitioner.given_name}
          />
          <Field
            label={t('detail.card.practitioner.field.qualification')}
            value={practitioner.qualification ?? '—'}
          />
        </dl>
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('detail.card.practitioner.roles.title')}
          </h4>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('detail.card.practitioner.roles.empty')}
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {sorted.map((role) => {
                const closed = role.period_end != null
                return (
                  <li
                    key={role.id}
                    className={
                      closed
                        ? 'flex items-center justify-between gap-3 px-3 py-2 text-sm text-muted-foreground'
                        : 'flex items-center justify-between gap-3 px-3 py-2 text-sm'
                    }
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="font-mono text-xs">{role.code}</span>
                      <span className="truncate">{role.organisation_id}</span>
                      {role.is_primary ? (
                        <Badge variant="soft">
                          {t('detail.card.practitioner.roles.primary_chip')}
                        </Badge>
                      ) : null}
                      {closed ? (
                        <Badge variant="outline">
                          {t('detail.card.practitioner.roles.closed_chip')}
                        </Badge>
                      ) : null}
                    </div>
                    <span className="font-mono text-xs">
                      {role.period_start.slice(0, 10)} –{' '}
                      {role.period_end
                        ? role.period_end.slice(0, 10)
                        : t('detail.card.practitioner.roles.open')}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Field({ label, value }: { label: string; value: ReactElement | string }): ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  )
}
