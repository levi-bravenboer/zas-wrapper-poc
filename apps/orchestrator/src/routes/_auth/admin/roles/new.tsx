// surface-opt-out: app-only
import { createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { RoleFormPage } from '@/modules/user/components/RoleFormPage'

export const Route = createFileRoute('/_auth/admin/roles/new')({
  component: AdminRoleCreateRoute,
})

function AdminRoleCreateRoute(): ReactElement {
  return <RoleFormPage mode="create" />
}
