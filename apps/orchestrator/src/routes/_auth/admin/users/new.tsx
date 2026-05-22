// surface-opt-out: app-only
import { createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { UserFormPage } from '@/modules/user/components/UserFormPage'

export const Route = createFileRoute('/_auth/admin/users/new')({
  component: AdminUserCreateRoute,
})

function AdminUserCreateRoute(): ReactElement {
  return <UserFormPage mode="create" />
}
