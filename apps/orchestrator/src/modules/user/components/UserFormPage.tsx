import { useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  AtSign,
  Lock,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useRef, type ReactElement, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { EntityFormPage } from '@/components/entity'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDirtyGuard, useEntityForm, type UseEntityFormResult } from '@/hooks/entity'
import type { ApiError } from '@/lib/api/errors'
import { initials } from '@/lib/utils/initials'

import { createUser, updateUserDemographics } from '../api'
import type { Role, UserCreatePayload } from '../schemas'

import { userFormSchema, type UserFormValues } from './userForm.schema'

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e && 'message' in e
}

function buildCreatePayload(values: UserFormValues): UserCreatePayload {
  if (values.role === 'admin') {
    return {
      email: values.email,
      role: 'admin',
      display_name: values.display_name,
    }
  }
  const qualification = values.qualification?.trim()
  return {
    email: values.email,
    role: 'caregiver',
    given_name: values.given_name,
    family_name: values.family_name,
    ...(qualification ? { qualification } : {}),
  }
}

const mockEditDefaults: Record<string, UserFormValues> = {
  'u-care-1': {
    email: 'sanne.jansen@zas.demo',
    role: 'caregiver',
    display_name: 'Sanne Jansen',
    given_name: 'Sanne',
    family_name: 'Jansen',
    qualification: 'Huisarts',
  },
  'u-admin-self': {
    email: 'admin@zas.demo',
    role: 'admin',
    display_name: 'Bo de Vries',
    given_name: '',
    family_name: '',
    qualification: '',
  },
}

const CREATE_DEFAULTS: UserFormValues = {
  email: '',
  role: 'caregiver',
  display_name: '',
  given_name: '',
  family_name: '',
  qualification: '',
}

interface BaseProps {
  mode: 'create' | 'edit'
  userId?: string
}

export function UserFormPage(props: BaseProps): ReactElement {
  return props.mode === 'create' ? <CreateUserForm /> : <EditUserForm userId={props.userId!} />
}

function CreateUserForm(): ReactElement {
  const { t } = useTranslation('users-admin-ui')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const createdIdRef = useRef<string | null>(null)

  const formApi = useEntityForm<UserFormValues>({
    schema: userFormSchema,
    defaultValues: CREATE_DEFAULTS,
    onSubmit: async (values) => {
      try {
        const created = await createUser(buildCreatePayload(values))
        createdIdRef.current = created.id
      } catch (e) {
        if (isApiError(e) && e.status === 409 && e.code === 'conflict.user.email_exists') {
          formApi.form.setFieldMeta('email', (prev) => ({
            ...prev,
            errors: [t('form.error.email_exists')],
            errorMap: { ...prev.errorMap, onSubmit: t('form.error.email_exists') },
          }))
        } else {
          toast.error(t('toast.create_failed'))
        }
        throw e
      }
    },
    onSuccess: () => {
      toast.success(t('toast.created'))
      dirtyGuard.dismiss()
      void qc.invalidateQueries({ queryKey: ['users'] })
      if (createdIdRef.current) {
        void navigate({
          to: '/admin/users/$userId',
          params: { userId: createdIdRef.current },
        })
      } else {
        void navigate({ to: '/admin/users' })
      }
    },
  })
  const dirtyGuard = useDirtyGuard({ isDirty: formApi.isDirty })

  return (
    <UserFormShell
      mode="create"
      title={t('form.create.title')}
      subtitle={t('form.create.sub')}
      submitLabel={t('form.create.submit')}
      back={{ to: '/admin/users' }}
      formApi={formApi}
      dirtyGuard={dirtyGuard}
      onCancel={() => {
        dirtyGuard.dismiss()
        void navigate({ to: '/admin/users' })
      }}
    />
  )
}

function EditUserForm({ userId }: { userId: string }): ReactElement {
  const { t } = useTranslation('users-admin-ui')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const defaults = mockEditDefaults[userId] ?? { ...CREATE_DEFAULTS }

  const formApi = useEntityForm<UserFormValues>({
    schema: userFormSchema,
    defaultValues: defaults,
    onSubmit: async (values) => {
      const display_name =
        values.role === 'caregiver'
          ? `${values.given_name.trim()} ${values.family_name.trim()}`.trim()
          : values.display_name.trim()
      try {
        await updateUserDemographics(userId, { display_name })
      } catch (e) {
        toast.error(t('toast.update_failed'))
        throw e
      }
    },
    onSuccess: () => {
      toast.success(t('toast.updated'))
      dirtyGuard.dismiss()
      void qc.invalidateQueries({ queryKey: ['users'] })
      void qc.invalidateQueries({ queryKey: ['user', userId] })
      void navigate({ to: '/admin/users/$userId', params: { userId } })
    },
  })
  const dirtyGuard = useDirtyGuard({ isDirty: formApi.isDirty })

  return (
    <UserFormShell
      mode="edit"
      title={t('form.edit.title')}
      subtitle={t('form.edit.sub', { name: defaults.display_name })}
      submitLabel={t('form.edit.submit')}
      back={{ to: '/admin/users/$userId', params: { userId } }}
      formApi={formApi}
      dirtyGuard={dirtyGuard}
      onCancel={() => {
        dirtyGuard.dismiss()
        void navigate({ to: '/admin/users/$userId', params: { userId } })
      }}
    />
  )
}

interface ShellProps {
  mode: 'create' | 'edit'
  title: string
  subtitle: string
  submitLabel: string
  back: { to: string; params?: Record<string, string> }
  formApi: UseEntityFormResult<UserFormValues>
  dirtyGuard: ReturnType<typeof useDirtyGuard>
  onCancel: () => void
}

function UserFormShell({
  mode,
  title,
  subtitle,
  submitLabel,
  back,
  formApi,
  dirtyGuard,
  onCancel,
}: ShellProps): ReactElement {
  const { t } = useTranslation('users-admin-ui')
  const role = useStore(formApi.form.store, (s) => s.values.role)
  const displayName = useStore(formApi.form.store, (s) => s.values.display_name)
  const givenName = useStore(formApi.form.store, (s) => s.values.given_name)
  const familyName = useStore(formApi.form.store, (s) => s.values.family_name)
  const email = useStore(formApi.form.store, (s) => s.values.email)
  const editing = mode === 'edit'
  const derivedName =
    role === 'caregiver' ? [givenName, familyName].filter((s) => s?.trim()).join(' ') : displayName
  const heroName = derivedName?.trim() || t('form.hero.placeholder_name')
  const heroEmail = email?.trim() || t('form.hero.placeholder_email')
  const heroInitials = derivedName?.trim() || '·'

  return (
    <>
      <EntityFormPage<UserFormValues>
        mode={mode}
        title={title}
        subtitle={subtitle}
        back={back as never}
        form={formApi}
        submitLabel={submitLabel}
        onCancel={onCancel}
        body={
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 py-2">
            <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/5 via-background to-background p-6">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/10 blur-3xl"
              />
              <div className="relative flex items-center gap-5">
                <Avatar size="lg" className="size-16 ring-4 ring-background shadow-sm">
                  <AvatarFallback className="text-lg">{initials(heroInitials)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-xl font-semibold tracking-tight">{heroName}</h2>
                    <RoleBadge role={role} t={t} />
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                    <AtSign className="size-3.5" aria-hidden />
                    <span className="truncate">{heroEmail}</span>
                  </p>
                </div>
                {!editing ? (
                  <Badge variant="soft" className="hidden gap-1 sm:inline-flex">
                    <Sparkles className="size-3" aria-hidden />
                    {t('form.hero.new_chip')}
                  </Badge>
                ) : null}
              </div>
            </div>

            <Card>
              <CardHeader>
                <SectionHeader
                  icon={UserRound}
                  step="01"
                  title={t('form.section.identity.title')}
                  sub={t('form.section.identity.sub')}
                />
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {role === 'caregiver' ? (
                  <div className="grid gap-5 md:grid-cols-2">
                    <formApi.form.Field name="given_name">
                      {(field) => (
                        <FieldRow
                          htmlFor="user-given-name"
                          icon={UserRound}
                          label={t('form.field.given_name.label')}
                          hint={
                            editing
                              ? t('form.field.given_name.locked')
                              : t('form.field.given_name.hint')
                          }
                          locked={editing}
                          required
                          error={firstError(field.state.meta.errors, t)}
                        >
                          <Input
                            id="user-given-name"
                            autoComplete="off"
                            placeholder={t('form.field.given_name.placeholder')}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            disabled={editing}
                            aria-invalid={field.state.meta.errors.length > 0}
                          />
                        </FieldRow>
                      )}
                    </formApi.form.Field>

                    <formApi.form.Field name="family_name">
                      {(field) => (
                        <FieldRow
                          htmlFor="user-family-name"
                          icon={UserRound}
                          label={t('form.field.family_name.label')}
                          hint={
                            editing
                              ? t('form.field.family_name.locked')
                              : t('form.field.family_name.hint')
                          }
                          locked={editing}
                          required
                          error={firstError(field.state.meta.errors, t)}
                        >
                          <Input
                            id="user-family-name"
                            autoComplete="off"
                            placeholder={t('form.field.family_name.placeholder')}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            disabled={editing}
                            aria-invalid={field.state.meta.errors.length > 0}
                          />
                        </FieldRow>
                      )}
                    </formApi.form.Field>
                  </div>
                ) : (
                  <formApi.form.Field name="display_name">
                    {(field) => (
                      <FieldRow
                        htmlFor="user-display-name"
                        icon={UserRound}
                        label={t('form.field.display_name.label')}
                        hint={t('form.field.display_name.hint')}
                        required
                        error={firstError(field.state.meta.errors, t)}
                      >
                        <Input
                          id="user-display-name"
                          autoComplete="off"
                          placeholder={t('form.field.display_name.placeholder')}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          aria-invalid={field.state.meta.errors.length > 0}
                        />
                      </FieldRow>
                    )}
                  </formApi.form.Field>
                )}

                <div className="grid gap-5 md:grid-cols-2">
                  <formApi.form.Field name="email">
                    {(field) => (
                      <FieldRow
                        htmlFor="user-email"
                        icon={AtSign}
                        label={t('form.field.email.label')}
                        hint={editing ? t('form.field.email.locked') : t('form.field.email.hint')}
                        locked={editing}
                        required
                        error={firstError(field.state.meta.errors, t)}
                      >
                        <Input
                          id="user-email"
                          type="email"
                          autoComplete="off"
                          placeholder={t('form.field.email.placeholder')}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          disabled={editing}
                          aria-invalid={field.state.meta.errors.length > 0}
                        />
                      </FieldRow>
                    )}
                  </formApi.form.Field>

                  <formApi.form.Field name="role">
                    {(field) => (
                      <FieldRow
                        htmlFor="user-role"
                        icon={ShieldCheck}
                        label={t('form.field.role.label')}
                        hint={editing ? t('form.field.role.locked') : t('form.field.role.hint')}
                        locked={editing}
                      >
                        <Select
                          value={field.state.value}
                          onValueChange={(v) => field.handleChange(v as Role)}
                          disabled={editing}
                        >
                          <SelectTrigger id="user-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="caregiver">
                              {t('form.field.role.option.caregiver')}
                            </SelectItem>
                            <SelectItem value="admin">
                              {t('form.field.role.option.admin')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldRow>
                    )}
                  </formApi.form.Field>
                </div>
              </CardContent>
            </Card>

            {role === 'caregiver' ? (
              <Card>
                <CardHeader>
                  <SectionHeader
                    icon={Stethoscope}
                    step="02"
                    title={t('form.section.practitioner.title')}
                    sub={t('form.section.practitioner.sub')}
                  />
                </CardHeader>
                <CardContent>
                  <formApi.form.Field name="qualification">
                    {(field) => (
                      <FieldRow
                        htmlFor="user-qualification"
                        icon={Stethoscope}
                        label={t('form.field.qualification.label')}
                        hint={
                          editing
                            ? t('form.field.qualification.locked')
                            : t('form.field.qualification.hint')
                        }
                        locked={editing}
                      >
                        <Input
                          id="user-qualification"
                          autoComplete="off"
                          placeholder={t('form.field.qualification.placeholder')}
                          value={field.state.value ?? ''}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          disabled={editing}
                        />
                      </FieldRow>
                    )}
                  </formApi.form.Field>
                </CardContent>
              </Card>
            ) : null}
          </div>
        }
      />
      {dirtyGuard.dialog}
    </>
  )
}

function SectionHeader({
  icon: Icon,
  step,
  title,
  sub,
}: {
  icon: LucideIcon
  step: string
  title: string
  sub: string
}): ReactElement {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {step}
          </span>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription className="mt-0.5">{sub}</CardDescription>
      </div>
    </div>
  )
}

function RoleBadge({ role, t }: { role: Role; t: (key: string) => string }): ReactElement {
  const isAdmin = role === 'admin'
  return (
    <Badge variant={isAdmin ? 'default' : 'soft'} className="gap-1">
      {isAdmin ? (
        <ShieldCheck className="size-3" aria-hidden />
      ) : (
        <Stethoscope className="size-3" aria-hidden />
      )}
      {t(`role.${role}`)}
    </Badge>
  )
}

interface FieldRowProps {
  htmlFor: string
  icon?: LucideIcon | undefined
  label: string
  hint?: string | undefined
  locked?: boolean | undefined
  required?: boolean | undefined
  error?: string | undefined
  children: ReactNode
}

function FieldRow({
  htmlFor,
  icon: Icon,
  label,
  hint,
  locked,
  required,
  error,
  children,
}: FieldRowProps): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="inline-flex items-center gap-1.5 text-sm font-medium">
          {Icon ? <Icon className="size-3.5 text-muted-foreground" aria-hidden /> : null}
          {label}
          {required && !locked ? (
            <span className="text-destructive" aria-hidden>
              *
            </span>
          ) : null}
        </Label>
        {locked ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" aria-hidden />
            {hint}
          </span>
        ) : null}
      </div>
      {children}
      {!locked && hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

// Standard-Schema issues bubble up as `{ message: string, path?, code? }`.
// Our Zod schema sets `message` to an i18n key (e.g. `form.error.required`);
// resolve via t() here so the field shows localised copy, not the raw key.
function firstError(
  errors: ReadonlyArray<unknown>,
  t: (key: string) => string,
): string | undefined {
  if (errors.length === 0) return undefined
  const first = errors[0]
  const raw =
    typeof first === 'string'
      ? first
      : typeof first === 'object' && first !== null && 'message' in first
        ? String((first as { message: unknown }).message)
        : String(first)
  // i18n keys we own start with `form.error.`; pass through otherwise.
  return raw.startsWith('form.error.') ? t(raw) : raw
}
