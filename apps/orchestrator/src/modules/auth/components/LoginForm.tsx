import { useForm } from '@tanstack/react-form'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLogin } from '@/modules/auth/hooks'

import { safeRedirect } from '../redirect'
import { loginSchema } from '../schemas'

type ErrorKey = 'invalid' | 'unknown'

function statusToErrorKey(status: number | undefined): ErrorKey {
  return status === 401 ? 'invalid' : 'unknown'
}

export function LoginForm(): ReactElement {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const redirect = useRouterState({
    select: (state) => {
      const value = (state.location.search as Record<string, unknown>).redirect
      return typeof value === 'string' ? value : undefined
    },
  })
  const login = useLogin()
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null)

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value, formApi }) => {
      setErrorKey(null)
      try {
        await login.mutateAsync(value)
        await navigate({ to: safeRedirect(redirect) })
      } catch (err) {
        const status = (err as { status?: number } | null)?.status
        const key = statusToErrorKey(status)
        setErrorKey(key)
        if (key === 'invalid') {
          formApi.setFieldValue('password', '')
        }
      }
    },
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      className="flex flex-col gap-6"
      noValidate
    >
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {t('login.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('login.subtitle')}</p>
      </header>

      <form.Field
        name="email"
        validators={{
          onSubmit: ({ value }) => {
            const result = loginSchema.shape.email.safeParse(value)
            return result.success ? undefined : t('login.errors.invalid')
          },
        }}
      >
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-email">{t('login.fields.email')}</Label>
            <Input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              aria-invalid={!!field.state.meta.errors.length}
            />
            {!!field.state.meta.errors.length && (
              <p className="text-sm text-destructive" role="alert">
                {String(field.state.meta.errors[0])}
              </p>
            )}
          </div>
        )}
      </form.Field>

      <form.Field
        name="password"
        validators={{
          onSubmit: ({ value }) => {
            const result = loginSchema.shape.password.safeParse(value)
            return result.success ? undefined : t('login.errors.required')
          },
        }}
      >
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-password">{t('login.fields.password')}</Label>
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              aria-invalid={!!field.state.meta.errors.length}
            />
            {!!field.state.meta.errors.length && (
              <p className="text-sm text-destructive" role="alert">
                {String(field.state.meta.errors[0])}
              </p>
            )}
          </div>
        )}
      </form.Field>

      <Button type="submit" className="w-full" disabled={login.isPending}>
        {login.isPending ? t('login.submitting') : t('login.submit')}
      </Button>

      {errorKey !== null && (
        <p role="alert" className="text-sm text-destructive text-center">
          {t(`login.errors.${errorKey === 'invalid' ? 'invalid_credentials' : 'unknown'}`)}
        </p>
      )}
    </form>
  )
}
