import { useForm } from '@tanstack/react-form'
import { useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormField, FormMessage } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { toast } from '@/components/ui/toast'

import { useLogin } from '../hooks'
import { loginSchema } from '../schemas'

type LoginFormProps = {
  redirectTo?: string | undefined
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const { t } = useTranslation('auth')
  const router = useRouter()
  const loginMutation = useLogin()

  const form = useForm({
    defaultValues: { username: '', password: '' },
    onSubmit: async ({ value }) => {
      try {
        await loginMutation.mutateAsync(value)
        await router.navigate({ to: redirectTo ?? '/' })
      } catch {
        toast.error(t('login.errors.unknown'))
      }
    },
    validators: {
      onSubmit: ({ value }) => {
        const parsed = loginSchema.safeParse(value)
        if (parsed.success) return undefined
        return {
          fields: Object.fromEntries(
            parsed.error.issues.map((issue) => [issue.path[0], issue.message]),
          ),
        }
      },
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('login.title')}</CardTitle>
        <CardDescription>{t('login.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.Field
            name="username"
            validators={{
              onChange: ({ value }) => (value.length === 0 ? t('login.errors.required') : undefined),
            }}
          >
            {(field) => (
              <FormField>
                <Label htmlFor={field.name}>{t('login.fields.username')}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  autoComplete="username"
                />
                <FormMessage>{field.state.meta.errors[0]}</FormMessage>
              </FormField>
            )}
          </form.Field>

          <form.Field
            name="password"
            validators={{
              onChange: ({ value }) => (value.length === 0 ? t('login.errors.required') : undefined),
            }}
          >
            {(field) => (
              <FormField>
                <Label htmlFor={field.name}>{t('login.fields.password')}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  autoComplete="current-password"
                />
                <FormMessage>{field.state.meta.errors[0]}</FormMessage>
              </FormField>
            )}
          </form.Field>

          <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
            {([canSubmit, isSubmitting]) => (
              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {isSubmitting ? t('login.submitting') : t('login.submit')}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  )
}
