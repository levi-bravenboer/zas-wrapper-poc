import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { ProviderList } from '@/modules/auth/components/ProviderList'

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  component: LoginPage,
})

function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <ProviderList />
      </div>
    </main>
  )
}
