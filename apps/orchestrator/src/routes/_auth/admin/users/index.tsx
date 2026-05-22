// surface-opt-out: app-only
import { createFileRoute } from '@tanstack/react-router'

import { UserListPage } from '@/modules/user/components/UserListPage'

export const Route = createFileRoute('/_auth/admin/users/')({
  component: UserListPage,
  staticData: { breadcrumb: 'Gebruikers' },
})
