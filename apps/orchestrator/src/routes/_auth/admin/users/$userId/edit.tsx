import { createFileRoute, useParams } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { UserFormPage } from '@/modules/user/components/UserFormPage'

export const Route = createFileRoute('/_auth/admin/users/$userId/edit')({
  component: AdminUserEditRoute,
})

function AdminUserEditRoute(): ReactElement {
  const { userId } = useParams({ from: '/_auth/admin/users/$userId/edit' })
  return <UserFormPage mode="edit" userId={userId} />
}
