// surface-opt-out: app-only
import { createFileRoute, useParams } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { RoleDetailPage } from '@/modules/user/components/RoleDetailPage'

export const Route = createFileRoute('/_auth/admin/roles/$roleId/')({
  component: AdminRoleDetailRoute,
  staticData: { breadcrumb: 'header.crumb.role' },
})

function AdminRoleDetailRoute(): ReactElement {
  const { roleId } = useParams({ from: '/_auth/admin/roles/$roleId/' })
  return <RoleDetailPage roleId={roleId} />
}
