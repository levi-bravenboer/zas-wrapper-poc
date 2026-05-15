import type { QueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'

import { requireSession } from '@/modules/auth/guard'
import { AppShell } from '@/platform/embed/AppShell'

export type AuthBeforeLoadArgs = {
  context: { queryClient: QueryClient }
  location: { href: string }
}

export async function authBeforeLoad({ context, location }: AuthBeforeLoadArgs) {
  const session = await requireSession(context.queryClient)
  if (!session) {
    throw redirect({
      to: '/login',
      search: { redirect: location.href },
    })
  }
  return { session }
}

export const Route = createFileRoute('/_auth')({
  beforeLoad: authBeforeLoad,
  component: AppShell,
})
