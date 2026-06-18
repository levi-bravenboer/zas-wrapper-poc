import { Link, useNavigate } from '@tanstack/react-router'
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { type ReactElement, useState } from 'react'
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
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useCan } from '@/modules/auth/permissions'

import { useDeleteRole, useRoles, type Role } from '../roles'

/** Admin roles list — create / edit / delete the tenant's RBAC roles.
 *  System roles (admin, default) are never deletable. */
export function RolesListPage(): ReactElement {
  const { t } = useTranslation('roles-admin-ui')
  const navigate = useNavigate()
  const roles = useRoles()
  const deleteRole = useDeleteRole()
  const canCreate = useCan('role.create')
  const canUpdate = useCan('role.update')
  const canDelete = useCan('role.delete')
  const [pendingDelete, setPendingDelete] = useState<Role | null>(null)

  const items = roles.data ?? []

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-6 py-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold text-foreground">
            {t('list.title', { defaultValue: 'Rollen' })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('list.sub', { defaultValue: 'Beheer rollen en hun permissies.' })}
          </p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link to="/admin/roles/new">
              <Plus className="size-4" aria-hidden />
              {t('list.cta.create', { defaultValue: 'Nieuwe rol' })}
            </Link>
          </Button>
        ) : null}
      </header>

      {roles.isLoading ? (
        <p className="text-sm text-muted-foreground">{t('list.loading', { defaultValue: 'Laden…' })}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('list.empty', { defaultValue: 'Geen rollen.' })}</p>
      ) : (
        <Card className="divide-y divide-border/60">
          {items.map((role) => (
            <div key={role.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary-soft/50 text-primary">
                <ShieldCheck className="size-4" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{role.name}</span>
                  {role.is_system ? (
                    <Badge variant="soft" className="text-[10px]">
                      {t('list.systemBadge', { defaultValue: 'systeem' })}
                    </Badge>
                  ) : null}
                </div>
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  {role.slug} · {t('list.permCount', {
                    defaultValue: '{{count}} permissies',
                    count: role.permissions.length,
                  })}
                </span>
              </div>
              <div className="flex shrink-0 items-center">
                {canUpdate ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={t('list.action.edit', { defaultValue: 'Bewerken' })}
                    onClick={() => void navigate({ to: '/admin/roles/$roleId/edit', params: { roleId: role.id } })}
                  >
                    <Pencil className="size-4" />
                  </Button>
                ) : null}
                {canDelete && !role.is_system ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    aria-label={t('list.action.delete', { defaultValue: 'Verwijderen' })}
                    onClick={() => setPendingDelete(role)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('delete.title', { defaultValue: 'Rol verwijderen?' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.description', {
                defaultValue: 'Dit kan alleen als geen gebruiker deze rol heeft.',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('delete.cancel', { defaultValue: 'Annuleren' })}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!pendingDelete) return
                const role = pendingDelete
                setPendingDelete(null)
                deleteRole.mutate(role.id, {
                  onSuccess: () => toast.success(t('toast.deleted', { defaultValue: 'Rol verwijderd' })),
                  onError: () => toast.error(t('toast.error', { defaultValue: 'Er ging iets mis' })),
                })
              }}
            >
              {t('delete.confirm', { defaultValue: 'Verwijderen' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
