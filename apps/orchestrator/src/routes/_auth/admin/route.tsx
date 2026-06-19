// surface-opt-out: app-only
import type { QueryClient } from '@tanstack/react-query'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { requireSession } from '@/modules/auth/guard'

type AdminBeforeLoadArgs = {
  context: { queryClient: QueryClient }
}

// Any management permission grants the admin section; per-page guards + button
// gating narrow it further. A `default` role granted, say, `user.read` reaches
// admin without holding the `admin` role (dynamic-rbac D12).
const ADMIN_SECTION_PERMISSIONS = [
  'user.read',
  'role.read',
  'organisation.read',
  'audit.read',
  'practitionerRole.read',
  'specialism.read',
] as const

export async function adminBeforeLoad({ context }: AdminBeforeLoadArgs) {
  const session = await requireSession(context.queryClient)
  const allowed =
    !!session && ADMIN_SECTION_PERMISSIONS.some((p) => session.permissions.includes(p))
  if (!allowed) {
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
