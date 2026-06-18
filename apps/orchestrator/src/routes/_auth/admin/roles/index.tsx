// surface-opt-out: app-only
import { createFileRoute } from '@tanstack/react-router'

import { RolesListPage } from '@/modules/user/components/RolesListPage'

export const Route = createFileRoute('/_auth/admin/roles/')({
  component: RolesListPage,
  staticData: { breadcrumb: 'Rollen' },
})
