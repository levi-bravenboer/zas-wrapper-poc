import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ClipboardList, Pencil, Stethoscope, UserMinus } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  DetailCard,
  DetailRow,
  EntityDetailPage,
  EntityDetailSingleColumn,
  EntityDetailSkeleton,
  EntityErrorCard,
  EntityNotFound,
} from '@/components/entity'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { components } from '@/lib/api/schema'
import { cn } from '@/lib/style/cn'
import { useSession } from '@/modules/auth/hooks'

import { fetchPractitioner, type PractitionerRead } from '../api'
import { formatTimestamp } from '../format'
import { useSetUserActive, useUserDetail } from '../hooks'
import { practitionerKeys } from '../keys'
import { useRoleMap } from '../roles'
import type { UserDetail } from '../schemas'

import { RoleBadge } from './RoleBadge'
import { StatusPill } from './StatusPill'

type PractitionerRoleRead = components['schemas']['PractitionerRoleRead']

export interface UserDetailPageProps {
  userId: string
}

export function UserDetailPage({ userId }: UserDetailPageProps): ReactElement {
  const { t } = useTranslation('users-admin-ui')
  const session = useSession()
  const userQuery = useUserDetail(userId)
  const setActive = useSetUserActive()
  const roleMap = useRoleMap()
  // Clinician = any non-admin role (interim: identity-type is data-derived; a
  // practitioner row only exists for clinical users).
  const isClinician = !!userQuery.data && roleMap.get(userQuery.data.role_id)?.slug !== 'admin'
  const practitionerQuery = useQuery({
    queryKey: practitionerKeys.detail(userId),
    queryFn: () => fetchPractitioner(userId),
    enabled: isClinician,
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
  const showPractitioner = isClinician && practitioner !== null
  const isSelf = user.id === (session.data?.id ?? '')

  return (
    <EntityDetailPage
      title={user.display_name}
      subtitle={
        <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <RoleBadge roleId={user.role_id} withIcon />
          <StatusPill active={user.is_active} />
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
          <DemographicsBlock user={user} />
          {showPractitioner ? <PractitionerBlock practitioner={practitioner} /> : null}
        </EntityDetailSingleColumn>
      }
    />
  )
}

function DemographicsBlock({ user }: { user: UserDetail }): ReactElement {
  const { t } = useTranslation('users-admin-ui')
  return (
    <DetailCard icon={ClipboardList} title={t('detail.card.demographics.title')}>
      <DetailRow label={t('detail.card.demographics.field.display_name')}>
        {user.display_name}
      </DetailRow>
      <DetailRow label={t('detail.card.demographics.field.email')}>{user.email}</DetailRow>
      <DetailRow label={t('detail.card.demographics.field.role')}>
        <RoleBadge roleId={user.role_id} />
      </DetailRow>
      <DetailRow label={t('detail.card.demographics.field.is_active')}>
        <StatusPill active={user.is_active} />
      </DetailRow>
      <DetailRow label={t('detail.card.demographics.field.created_at')}>
        {formatTimestamp(user.created_at)}
      </DetailRow>
    </DetailCard>
  )
}

function PractitionerBlock({ practitioner }: { practitioner: PractitionerRead }): ReactElement {
  const { t } = useTranslation('users-admin-ui')
  const sorted: PractitionerRoleRead[] = [...practitioner.roles].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
    return b.period_start.localeCompare(a.period_start)
  })

  return (
    <DetailCard icon={Stethoscope} title={t('detail.card.practitioner.title')}>
      <DetailRow label={t('detail.card.practitioner.field.family_name')}>
        {practitioner.family_name}
      </DetailRow>
      <DetailRow label={t('detail.card.practitioner.field.given_name')}>
        {practitioner.given_name}
      </DetailRow>
      <DetailRow label={t('detail.card.practitioner.field.qualification')}>
        {practitioner.qualification ?? '—'}
      </DetailRow>
      <DetailRow wide label={t('detail.card.practitioner.roles.title')}>
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
                  className={cn(
                    'flex items-center justify-between gap-3 px-3 py-2 text-sm',
                    closed && 'text-muted-foreground',
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="font-medium">{role.code}</span>
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
      </DetailRow>
    </DetailCard>
  )
}
