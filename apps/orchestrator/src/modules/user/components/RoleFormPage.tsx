import { useStore } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { type ReactElement, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { EntityDetailSkeleton, EntityFormPage, EntityNotFound } from '@/components/entity'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useEntityForm } from '@/hooks/entity'
import { useSession } from '@/modules/auth/hooks'

import { useCreateRole, usePermissions, useRole, useUpdateRole } from '../roles'

export interface RoleFormPageProps {
  mode: 'create' | 'edit'
  roleId?: string
}

interface RoleFormValues {
  name: string
  slug: string
  permissions: string[]
}

const roleFormSchema = z.object({
  name: z.string().trim().min(1, { message: 'form.error.required' }).max(120),
  slug: z.string().trim().regex(/^[a-z][a-z0-9-]*$/, { message: 'form.error.slug' }),
  permissions: z.array(z.string()),
})

function resourceOf(slug: string): string {
  return slug.split('.')[0] ?? slug
}

// Standard-Schema errors bubble as `{ message }`; our zod messages are i18n
// keys (`form.error.*`) resolved here against the roles-admin-ui namespace.
function firstError(
  errors: ReadonlyArray<unknown>,
  t: (key: string) => string,
): string | undefined {
  const first = errors[0]
  if (first === undefined) return undefined
  const raw =
    typeof first === 'object' && first !== null && 'message' in first
      ? String((first as { message: unknown }).message)
      : String(first)
  return raw.startsWith('form.error.') ? t(raw) : raw
}

/** Loads the role (edit) or seeds blank (create) before mounting the form so
 *  `useEntityForm` gets stable defaults. */
export function RoleFormPage({ mode, roleId }: RoleFormPageProps): ReactElement {
  const existing = useRole(mode === 'edit' ? (roleId ?? '') : '')

  if (mode === 'edit') {
    if (existing.isLoading) return <EntityDetailSkeleton />
    if (!existing.data) return <EntityNotFound backTo={{ to: '/admin/roles' }} />
    return (
      <RoleForm
        mode="edit"
        defaults={{
          name: existing.data.name,
          slug: existing.data.slug,
          permissions: existing.data.permissions,
        }}
        roleId={existing.data.id}
        isSystem={existing.data.is_system}
      />
    )
  }
  return <RoleForm mode="create" defaults={{ name: '', slug: '', permissions: [] }} />
}

function RoleForm({
  mode,
  defaults,
  roleId,
  isSystem = false,
}: {
  mode: 'create' | 'edit'
  defaults: RoleFormValues
  roleId?: string
  isSystem?: boolean
}): ReactElement {
  const { t } = useTranslation('roles-admin-ui')
  const navigate = useNavigate()
  const session = useSession()
  const catalog = usePermissions()
  const createRole = useCreateRole()
  const updateRole = useUpdateRole(roleId ?? '')
  const editing = mode === 'edit'

  const actorPerms = useMemo(
    () => new Set(session.data?.permissions ?? []),
    [session.data?.permissions],
  )

  const formApi = useEntityForm<RoleFormValues>({
    schema: roleFormSchema,
    defaultValues: defaults,
    onSubmit: async (values) => {
      try {
        if (editing) {
          await updateRole.mutateAsync({ name: values.name.trim(), permissions: values.permissions })
        } else {
          await createRole.mutateAsync({
            slug: values.slug,
            name: values.name.trim(),
            permissions: values.permissions,
          })
        }
      } catch (e) {
        toast.error(t('toast.error'))
        throw e
      }
    },
    onSuccess: () => {
      toast.success(
        editing
          ? t('toast.saved')
          : t('toast.created'),
      )
      void navigate({ to: '/admin/roles' })
    },
  })

  const selected = useStore(formApi.form.store, (s) => s.values.permissions)
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const grouped = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const slug of (catalog.data ?? []).toSorted()) {
      const r = resourceOf(slug)
      map.set(r, [...(map.get(r) ?? []), slug])
    }
    return [...map.entries()]
  }, [catalog.data])

  function toggle(perm: string): void {
    const next = selectedSet.has(perm)
      ? selected.filter((p) => p !== perm)
      : [...selected, perm]
    formApi.form.setFieldValue('permissions', next)
  }

  return (
    <EntityFormPage<RoleFormValues>
      mode={mode}
      title={
        editing
          ? t('form.edit.title')
          : t('form.create.title')
      }
      subtitle={t('form.sub')}
      back={{ to: '/admin/roles' }}
      form={formApi}
      submitLabel={t('form.save')}
      onCancel={() => void navigate({ to: '/admin/roles' })}
      body={
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 py-2">
          <Card>
            <CardContent className="grid gap-4 pt-5 md:grid-cols-2">
              <formApi.form.Field name="name">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="role-name">{t('form.field.name')}</Label>
                    <Input
                      id="role-name"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={field.state.meta.errors.length > 0}
                      placeholder={t('form.field.namePlaceholder')}
                    />
                    {firstError(field.state.meta.errors, t) ? (
                      <p className="text-xs text-destructive" role="alert">
                        {firstError(field.state.meta.errors, t)}
                      </p>
                    ) : null}
                  </div>
                )}
              </formApi.form.Field>
              <formApi.form.Field name="slug">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="role-slug">{t('form.field.slug')}</Label>
                    <Input
                      id="role-slug"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value.toLowerCase())}
                      onBlur={field.handleBlur}
                      disabled={editing}
                      aria-invalid={field.state.meta.errors.length > 0}
                      placeholder={t('form.slugPlaceholder')}
                      className="font-mono"
                    />
                    {!editing && firstError(field.state.meta.errors, t) ? (
                      <p className="text-xs text-destructive" role="alert">
                        {firstError(field.state.meta.errors, t)}
                      </p>
                    ) : null}
                  </div>
                )}
              </formApi.form.Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('form.permissions.title')}
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
                      return (
                        <label
                          key={perm}
                          className="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-sm has-[:disabled]:opacity-50"
                        >
                          <Checkbox
                            checked={selectedSet.has(perm)}
                            disabled={!grantable}
                            onCheckedChange={() => toggle(perm)}
                          />
                          <span className="font-mono text-xs">{perm.split('.')[1] ?? perm}</span>
                          {!grantable ? (
                            <Badge variant="soft" className="ml-auto text-[10px]">
                              {t('form.permissions.locked')}
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
              {t('form.systemNote')}
            </p>
          ) : null}
        </div>
      }
    />
  )
}
