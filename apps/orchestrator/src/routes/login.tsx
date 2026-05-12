import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { LoginForm } from '@/modules/auth/components/LoginForm'

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  component: LoginPage,
})

function LoginPage() {
  const { redirect } = Route.useSearch()
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <LoginForm redirectTo={redirect} />
      </div>
    </main>
  )
}
