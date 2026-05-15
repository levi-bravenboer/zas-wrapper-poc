import { ShieldCheck, UserCog, UserMinus, UserPlus } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { defineColumn, type BrandedColumnDef } from '@/components/data-table'
import { type DataTableFilter, type DataTableRowAction } from '@/components/data-table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { initials } from '@/lib/utils/initials'

import { formatTimestamp } from '../format'
import { useAssignUserRole, useSetUserActive } from '../hooks'
import { roleSchema, type Role, type UserRow } from '../schemas'

import { RoleBadge } from './RoleBadge'
import { StatusPill } from './StatusPill'

const ROLE_VALUES = roleSchema.options

export function useUserColumns(): ReadonlyArray<BrandedColumnDef<UserRow>> {
  const { t } = useTranslation('users')
  return useMemo(
    () => [
      defineColumn<UserRow>({
        id: 'display_name',
        header: t('columns.display_name'),
        sortKey: 'display_name',
        sticky: true,
        cell: (row) => (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar size="sm">
              <AvatarFallback>{initials(row.display_name)}</AvatarFallback>
            </Avatar>
            <span className="truncate font-medium text-foreground">{row.display_name}</span>
          </div>
        ),
      }),
      defineColumn<UserRow>({
        id: 'email',
        header: t('columns.email'),
        sortKey: 'email',
        cell: (row) => <span className="text-muted-foreground">{row.email}</span>,
      }),
      defineColumn<UserRow>({
        id: 'role',
        header: t('columns.role'),
        sortKey: 'role',
        filterKey: 'role',
        cell: (row) => <RoleBadge role={row.role} withIcon />,
      }),
      defineColumn<UserRow>({
        id: 'is_active',
        header: t('columns.is_active'),
        sortKey: 'is_active',
        filterKey: 'is_active',
        cell: (row) => <StatusPill active={row.is_active} />,
      }),
      defineColumn<UserRow>({
        id: 'created_at',
        header: t('columns.created_at'),
        sortKey: 'created_at',
        cell: (row) => (
          <span className="text-xs text-muted-foreground">{formatTimestamp(row.created_at)}</span>
        ),
      }),
    ],
    [t],
  )
}

export function useUserFilterDefs(): ReadonlyArray<DataTableFilter<UserRow>> {
  const { t } = useTranslation('users')
  return useMemo(
    () => [
      {
        type: 'multi',
        key: 'role',
        label: t('filters.role'),
        options: ROLE_VALUES.map((value) => ({ value, label: t(`role.${value}`) })),
      },
      {
        type: 'select',
        key: 'is_active',
        label: t('filters.is_active'),
        options: [
          { value: 'true', label: t('status.active') },
          { value: 'false', label: t('status.inactive') },
        ],
      },
    ],
    [t],
  )
}

export interface UserRowActionsParams {
  currentUserId: string
  onView: (row: UserRow) => void
}

export function useUserRowActions(
  params: UserRowActionsParams,
): (row: UserRow) => DataTableRowAction[] {
  const { t } = useTranslation('users')
  const setActive = useSetUserActive()
  const assignRole = useAssignUserRole()

  return (row) => {
    const isSelf = row.id === params.currentUserId
    const actions: DataTableRowAction[] = [
      {
        label: t('actions.view'),
        icon: <UserCog className="h-4 w-4" aria-hidden />,
        onClick: () => params.onView(row),
      },
    ]
    if (isSelf) return actions

    const runRole = (role: Role) =>
      assignRole.mutate(
        { userId: row.id, role },
        {
          onSuccess: () => toast.success(t('toast.role_updated')),
          onError: () => toast.error(t('toast.error')),
        },
      )

    const runActive = (is_active: boolean) =>
      setActive.mutate(
        { userId: row.id, is_active },
        {
          onSuccess: () =>
            toast.success(is_active ? t('toast.activated') : t('toast.deactivated')),
          onError: () => toast.error(t('toast.error')),
        },
      )

    actions.push(
      row.role === 'admin'
        ? {
            label: t('actions.demote_to_caregiver'),
            icon: <UserMinus className="h-4 w-4" aria-hidden />,
            onClick: () => runRole('caregiver'),
          }
        : {
            label: t('actions.promote_to_admin'),
            icon: <ShieldCheck className="h-4 w-4" aria-hidden />,
            onClick: () => runRole('admin'),
          },
    )

    actions.push(
      row.is_active
        ? {
            label: t('actions.deactivate'),
            icon: <UserMinus className="h-4 w-4" aria-hidden />,
            destructive: true,
            onClick: () => runActive(false),
          }
        : {
            label: t('actions.activate'),
            icon: <UserPlus className="h-4 w-4" aria-hidden />,
            onClick: () => runActive(true),
          },
    )
    return actions
  }
}
