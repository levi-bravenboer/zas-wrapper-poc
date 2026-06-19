import { Link, useNavigate } from '@tanstack/react-router'
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  defineColumn,
  EmptyRow,
  LoadingRows,
  RowActions,
  Table,
  type BrandedColumnDef,
  type DataTableRowAction,
} from '@/components/data-table'
import { stickyFirst } from '@/components/data-table/styles'
import { FilterableListPage } from '@/components/list/FilterableListPage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/style/cn'
import { useCan } from '@/modules/auth/permissions'

import { useDeleteRole, useRoles, type Role } from '../roles'

function useRoleColumns(): ReadonlyArray<BrandedColumnDef<Role>> {
  const { t } = useTranslation('roles-admin-ui')
  return [
    defineColumn<Role>({
      id: 'name',
      header: t('list.column.name'),
      sticky: true,
      cell: (role) => (
        <div className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-soft/50 text-primary">
            <ShieldCheck className="size-4" aria-hidden />
          </span>
          <span className="font-medium text-foreground">{role.name}</span>
          {role.is_system ? (
            <Badge variant="soft" className="text-[10px]">
              {t('list.systemBadge')}
            </Badge>
          ) : null}
        </div>
      ),
    }),
    defineColumn<Role>({
      id: 'slug',
      header: t('list.column.slug'),
      cell: (role) => <span className="font-mono text-xs text-muted-foreground">{role.slug}</span>,
    }),
    defineColumn<Role>({
      id: 'permissions',
      header: t('list.column.permissions'),
      cell: (role) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {role.permissions.length}
        </span>
      ),
    }),
  ]
}

/** Admin roles list — create / edit / delete the tenant's RBAC roles.
 *  System roles (admin, default) are never deletable. */
export function RolesListPage(): ReactElement {
  const { t } = useTranslation('roles-admin-ui')
  const { t: tTable } = useTranslation('data-table')
  const navigate = useNavigate()
  const roles = useRoles()
  const deleteRole = useDeleteRole()
  const canCreate = useCan('role.create')
  const canUpdate = useCan('role.update')
  const canDelete = useCan('role.delete')
  const columns = useRoleColumns()

  const items = roles.data ?? []
  const totalColumns = columns.length + 1

  const openDetail = (id: string): void =>
    void navigate({ to: '/admin/roles/$roleId', params: { roleId: id } })
  const openEdit = (id: string): void =>
    void navigate({ to: '/admin/roles/$roleId/edit', params: { roleId: id } })

  // Edit is a dedicated inline icon next to the kebab; the kebab keeps delete.
  const rowActions = (role: Role): DataTableRowAction[] => {
    const actions: DataTableRowAction[] = []
    if (canDelete && !role.is_system) {
      actions.push({
        label: t('list.action.delete'),
        icon: <Trash2 className="size-4" aria-hidden />,
        destructive: true,
        onClick: () =>
          deleteRole.mutate(role.id, {
            onSuccess: () => toast.success(t('toast.deleted')),
            onError: () => toast.error(t('toast.error')),
          }),
        confirm: {
          title: t('delete.title'),
          description: t('delete.description'),
          confirmLabel: t('delete.confirm'),
        },
      })
    }
    return actions
  }

  return (
    <FilterableListPage<Role>
      title={t('list.title')}
      description={t('list.sub')}
      primaryAction={
        canCreate ? (
          <Button asChild>
            <Link to="/admin/roles/new">
              <Plus className="size-4" aria-hidden />
              {t('list.cta.create')}
            </Link>
          </Button>
        ) : undefined
      }
      table={
        <Table.Root>
          <Table.Header>
            <Table.HeaderRow>
              {columns.map((col, idx) => (
                <Table.HeaderCell
                  key={col.id}
                  className={cn(col.className, (col.sticky ?? idx === 0) && stickyFirst)}
                >
                  {typeof col.header === 'function' ? col.header({ columnId: col.id }) : col.header}
                </Table.HeaderCell>
              ))}
              <Table.HeaderCell className="w-10">
                <span className="sr-only">{tTable('actions.menu.aria')}</span>
              </Table.HeaderCell>
            </Table.HeaderRow>
          </Table.Header>
          <Table.Body>
            {roles.isLoading ? (
              <LoadingRows columnCount={totalColumns} />
            ) : items.length === 0 ? (
              <EmptyRow columnCount={totalColumns} title={t('list.empty')} />
            ) : (
              items.map((role) => (
                <Table.Row
                  key={role.id}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => openDetail(role.id)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    openDetail(role.id)
                  }}
                >
                  {columns.map((col, idx) => (
                    <Table.Cell
                      key={col.id}
                      className={cn(col.className, (col.sticky ?? idx === 0) && stickyFirst)}
                    >
                      {col.cell(role)}
                    </Table.Cell>
                  ))}
                  <Table.Cell data-stop-row-click="" className="text-right">
                    <div className="flex items-center justify-end">
                      {canUpdate ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={t('list.action.edit')}
                          onClick={() => openEdit(role.id)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      ) : null}
                      <RowActions
                        actions={rowActions(role)}
                        ariaLabel={tTable('actions.menu.aria')}
                      />
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table.Root>
      }
    />
  )
}
