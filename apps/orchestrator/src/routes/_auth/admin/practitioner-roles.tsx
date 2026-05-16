import { createFileRoute } from '@tanstack/react-router'

import { AdminPlaceholder } from '@/components/layout/AdminPlaceholder'

export const Route = createFileRoute('/_auth/admin/practitioner-roles')({
  component: AdminPractitionerRolesPlaceholder,
})

function AdminPractitionerRolesPlaceholder() {
  return (
    <AdminPlaceholder
      titleKey="caregiver-shell:nav.practitionerRoles"
      ownerSpec="practitioner-roles-admin-ui"
    />
  )
}
