import { createFileRoute, redirect } from '@tanstack/react-router'

import { AppLayout } from '@/components/layout/AppLayout'
import { requireSession } from '@/modules/auth/guard'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context, location }) => {
    const session = await requireSession(context.queryClient)
    if (!session) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
    return { session }
  },
  component: AppLayout,
})
