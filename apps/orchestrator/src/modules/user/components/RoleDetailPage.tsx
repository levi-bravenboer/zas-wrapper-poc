import { Link } from '@tanstack/react-router'
import { ListChecks, Pencil, ShieldCheck } from 'lucide-react'
import { type ReactElement, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

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
import { useCan } from '@/modules/auth/permissions'

import { useRole, type Role } from '../roles'

export interface RoleDetailPageProps {
  roleId: string
}

function resourceOf(slug: string): string {
  return slug.split('.')[0] ?? slug
}

export function RoleDetailPage({ roleId }: RoleDetailPageProps): ReactElement {
  const { t } = useTranslation('roles-admin-ui')
  const roleQuery = useRole(roleId)
  const canUpdate = useCan('role.update')

  if (roleQuery.isLoading) return <EntityDetailSkeleton />
  if (roleQuery.error) {
    const status = (roleQuery.error as { status?: number } | null)?.status
    if (status === 404) return <EntityNotFound backTo={{ to: '/admin/roles' }} />
    return <EntityErrorCard onRetry={() => void roleQuery.refetch()} />
  }
  if (!roleQuery.data) return <EntityNotFound backTo={{ to: '/admin/roles' }} />

  const role = roleQuery.data

  return (
    <EntityDetailPage
      title={role.name}
      subtitle={
        <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono text-xs">{role.slug}</span>
          {role.is_system ? (
            <Badge variant="soft">{t('list.systemBadge')}</Badge>
          ) : null}
        </span>
      }
      back={{ to: '/admin/roles' }}
      actions={
        canUpdate ? (
          <Button asChild variant="outline">
            <Link to="/admin/roles/$roleId/edit" params={{ roleId: role.id }}>
              <Pencil className="size-4" aria-hidden />
              {t('detail.action.edit')}
            </Link>
          </Button>
        ) : undefined
      }
      body={
        <EntityDetailSingleColumn>
          <DetailCard icon={ShieldCheck} title={t('detail.card.role.title')}>
            <DetailRow label={t('detail.card.role.name')}>
              {role.name}
            </DetailRow>
            <DetailRow label={t('detail.card.role.slug')}>
              <span className="font-mono text-xs">{role.slug}</span>
            </DetailRow>
            <DetailRow label={t('detail.card.role.type')}>
              {role.is_system
                ? t('detail.card.role.system')
                : t('detail.card.role.custom')}
            </DetailRow>
            <DetailRow label={t('detail.card.role.permCount')}>
              <span className="tabular-nums">{role.permissions.length}</span>
            </DetailRow>
          </DetailCard>
          <PermissionSummary role={role} />
        </EntityDetailSingleColumn>
      }
    />
  )
}

function PermissionSummary({ role }: { role: Role }): ReactElement {
  const { t } = useTranslation('roles-admin-ui')
  const grouped = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const slug of [...role.permissions].toSorted()) {
      const r = resourceOf(slug)
      map.set(r, [...(map.get(r) ?? []), slug.split('.')[1] ?? slug])
    }
    return [...map.entries()]
  }, [role.permissions])

  return (
    <DetailCard
      icon={ListChecks}
      title={t('detail.card.permissions.title')}
    >
      <DetailRow wide label={t('detail.card.permissions.granted')}>
        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('detail.card.permissions.none')}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {grouped.map(([resource, verbs]) => (
              <div key={resource} className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {resource}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {verbs.map((v) => (
                    <Badge key={v} variant="soft" className="font-mono text-[11px]">
                      {v}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DetailRow>
    </DetailCard>
  )
}
