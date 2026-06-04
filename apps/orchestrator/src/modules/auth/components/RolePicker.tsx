import { useNavigate } from '@tanstack/react-router'
import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useSelectRole } from '@/modules/auth/hooks'

import { safeRedirect } from '../redirect'
import type { Role } from '../schemas'

/**
 * Multi-role humans pick their active role after credentials are verified
 * (REQ-NON-3): the session is live but unbound until one role is chosen.
 * Single-role users never see this component.
 */
export function RolePicker({
  roles,
  redirect,
}: {
  roles: Role[]
  redirect?: string | undefined
}): ReactElement {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const selectRole = useSelectRole()
  const [error, setError] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {t('rolePicker.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('rolePicker.subtitle')}</p>
      </header>
      <div className="flex flex-col gap-3">
        {roles.map((role) => (
          <Button
            key={role}
            type="button"
            variant="outline"
            className="w-full"
            disabled={selectRole.isPending}
            onClick={() => {
              setError(false)
              selectRole.mutate(role, {
                onSuccess: () => {
                  void navigate({ to: safeRedirect(redirect) })
                },
                onError: () => {
                  setError(true)
                },
              })
            }}
          >
            {t(`rolePicker.roles.${role}`, { defaultValue: role })}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive text-center">
          {t('rolePicker.error')}
        </p>
      )}
    </div>
  )
}
