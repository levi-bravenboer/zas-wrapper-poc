import { createFileRoute } from '@tanstack/react-router'

import { OrganisationsAdminPage } from '@/modules/organisation/components/OrganisationsAdminPage'

export const Route = createFileRoute('/_auth/admin/organisations')({
  component: OrganisationsAdminPage,
})
