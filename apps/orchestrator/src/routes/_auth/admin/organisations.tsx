import { createFileRoute } from '@tanstack/react-router'

import { AdminPlaceholder } from '@/components/layout/AdminPlaceholder'

export const Route = createFileRoute('/_auth/admin/organisations')({
  component: AdminOrganisationsPlaceholder,
})

function AdminOrganisationsPlaceholder() {
  return (
    <AdminPlaceholder
      titleKey="caregiver-shell:nav.organisations"
      ownerSpec="organisations-admin-ui"
    />
  )
}
