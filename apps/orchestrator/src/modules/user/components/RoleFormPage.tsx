import { useNavigate } from '@tanstack/react-router'
import { type ReactElement, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSession } from '@/modules/auth/hooks'

import {
  useCreateRole,
  usePermissions,
  useRole,
  useUpdateRole,
} from '../roles'

export interface RoleFormPageProps {
  mode: 'create' | 'edit'
  roleId?: string
}

function resourceOf(slug: string): string {
  return slug.split('.')[0] ?? slug
}

export function RoleFormPage({ mode, roleId }: RoleFormPageProps): ReactElement {
  const { t } = useTranslation('roles-admin-ui')
  const navigate = useNavigate()
  const session = useSession()
  const catalog = usePermissions()
  const existing = useRole(mode === 'edit' ? (roleId ?? '') : '')
  const createRole = useCreateRole()
  const updateRole = useUpdateRole(roleId ?? '')

  const actorPerms = useMemo(
    () => new Set(session.data?.permissions ?? []),
    [session.data?.permissions],
  )
  const editing = mode === 'edit'
  const role = existing.data

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [selected, setSelected] = useState<Set<string> | null>(null)
  // Initialise from the loaded role once (edit) — selected stays null until then.
  const effectiveSelected =
    selected ?? new Set(editing ? (role?.permissions ?? []) : [])
  const effectiveName = name || (editing ? (role?.name ?? '') : '')

  const isSystem = editing && role?.is_system === true
  const grouped = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const slug of (catalog.data ?? []).toSorted()) {
      const r = resourceOf(slug)
      map.set(r, [...(map.get(r) ?? []), slug])
    }
    return [...map.entries()]
  }, [catalog.data])

  function toggle(perm: string): void {
    const next = new Set(effectiveSelected)
    if (next.has(perm)) next.delete(perm)
    else next.add(perm)
    setSelected(next)
  }

  const valid = editing
    ? effectiveName.trim().length > 0
    : effectiveName.trim().length > 0 && /^[a-z][a-z0-9-]*$/.test(slug)

  function submit(): void {
    const permissions = [...effectiveSelected]
    if (editing) {
      updateRole.mutate(
        { name: effectiveName.trim(), permissions },
        {
          onSuccess: () => {
            toast.success(t('toast.saved', { defaultValue: 'Rol opgeslagen' }))
            void navigate({ to: '/admin/roles' })
          },
          onError: () => toast.error(t('toast.error', { defaultValue: 'Er ging iets mis' })),
        },
      )
    } else {
      createRole.mutate(
        { slug, name: effectiveName.trim(), permissions },
        {
          onSuccess: () => {
            toast.success(t('toast.created', { defaultValue: 'Rol aangemaakt' }))
            void navigate({ to: '/admin/roles' })
          },
          onError: () => toast.error(t('toast.error', { defaultValue: 'Er ging iets mis' })),
        },
      )
    }
  }

  const submitting = createRole.isPending || updateRole.isPending

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-6">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold text-foreground">
          {editing
            ? t('form.edit.title', { defaultValue: 'Rol bewerken' })
            : t('form.create.title', { defaultValue: 'Nieuwe rol' })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('form.sub', { defaultValue: 'Geef permissies aan deze rol.' })}
        </p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-name">{t('form.field.name', { defaultValue: 'Naam' })}</Label>
              <Input
                id="role-name"
                value={effectiveName}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('form.field.namePlaceholder', { defaultValue: 'Bijv. Verpleegkundige' })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-slug">{t('form.field.slug', { defaultValue: 'Slug' })}</Label>
              <Input
                id="role-slug"
                value={editing ? (role?.slug ?? '') : slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                disabled={editing}
                placeholder="verpleegkundige"
                className="font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('form.permissions.title', { defaultValue: 'Permissies' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {grouped.map(([resource, perms]) => (
            <section key={resource} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {resource}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {perms.map((perm) => {
                  // No-amplification (D7): can only grant a permission you hold.
                  const grantable = actorPerms.has(perm)
                  const checked = effectiveSelected.has(perm)
                  return (
                    <label
                      key={perm}
                      className="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-sm has-[:disabled]:opacity-50"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!grantable}
                        onCheckedChange={() => toggle(perm)}
                      />
                      <span className="font-mono text-xs">{perm.split('.')[1] ?? perm}</span>
                      {!grantable ? (
                        <Badge variant="soft" className="ml-auto text-[10px]">
                          {t('form.permissions.locked', { defaultValue: 'vergrendeld' })}
                        </Badge>
                      ) : null}
                    </label>
                  )
                })}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>

      {isSystem ? (
        <p className="text-xs text-muted-foreground">
          {t('form.systemNote', {
            defaultValue: 'Systeemrol — slug ligt vast en de rol is niet verwijderbaar.',
          })}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => void navigate({ to: '/admin/roles' })}>
          {t('form.cancel', { defaultValue: 'Annuleren' })}
        </Button>
        <Button disabled={!valid || submitting} onClick={submit}>
          {t('form.save', { defaultValue: 'Opslaan' })}
        </Button>
      </div>
      </div>
    </div>
  )
}
