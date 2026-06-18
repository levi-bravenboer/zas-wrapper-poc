// surface-opt-out: app-only
import { createFileRoute, useParams } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { RoleFormPage } from '@/modules/user/components/RoleFormPage'

export const Route = createFileRoute('/_auth/admin/roles/$roleId/edit')({
  component: AdminRoleEditRoute,
})

function AdminRoleEditRoute(): ReactElement {
  const { roleId } = useParams({ from: '/_auth/admin/roles/$roleId/edit' })
  return <RoleFormPage mode="edit" roleId={roleId} />
}
