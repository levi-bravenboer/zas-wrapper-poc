import { createFileRoute, useParams } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { UserDetailPage } from '@/modules/user/components/UserDetailPage'

export const Route = createFileRoute('/_auth/admin/users/$userId/')({
  component: AdminUserDetailRoute,
})

function AdminUserDetailRoute(): ReactElement {
  const { userId } = useParams({ from: '/_auth/admin/users/$userId/' })
  return <UserDetailPage userId={userId} />
}
