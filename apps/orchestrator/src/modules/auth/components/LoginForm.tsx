import { useNavigate } from '@tanstack/react-router'
import { type FormEvent, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// PoC placeholder: validation + mutation + cookie round-trip land under BL-035
// (see openspec/backlog.md). Submit unconditionally navigates to /dashboard.
export function LoginForm(): ReactElement {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    void navigate({ to: '/dashboard' })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {t('login.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('login.subtitle')}</p>
      </header>

      <div className="flex flex-col gap-2">
        <Label htmlFor="login-username">{t('login.fields.username')}</Label>
        <Input id="login-username" name="username" autoComplete="username" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="login-password">{t('login.fields.password')}</Label>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
        />
      </div>

      <Button type="submit" className="w-full">
        {t('login.submit')}
      </Button>
    </form>
  )
}
