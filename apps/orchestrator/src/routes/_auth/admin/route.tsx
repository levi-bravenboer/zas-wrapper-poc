import type { QueryClient } from '@tanstack/react-query'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { requireSession } from '@/modules/auth/guard'

type AdminBeforeLoadArgs = {
  context: { queryClient: QueryClient }
}

export async function adminBeforeLoad({ context }: AdminBeforeLoadArgs) {
  const session = await requireSession(context.queryClient)
  if (!session || session.role !== 'admin') {
    throw redirect({ to: '/' })
  }
  return { session }
}

export const Route = createFileRoute('/_auth/admin')({
  beforeLoad: adminBeforeLoad,
  component: AdminLayout,
})

function AdminLayout(): ReactElement {
  return <Outlet />
}
