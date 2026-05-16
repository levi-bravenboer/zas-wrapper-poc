import { createFileRoute } from '@tanstack/react-router'

import { AdminPlaceholder } from '@/components/layout/AdminPlaceholder'

export const Route = createFileRoute('/_auth/admin/users')({
  component: AdminUsersPlaceholder,
})

function AdminUsersPlaceholder() {
  return <AdminPlaceholder titleKey="caregiver-shell:nav.users" ownerSpec="users-admin-ui" />
}
