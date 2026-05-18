import { createFileRoute } from '@tanstack/react-router'

import { PractitionerRoleListPage } from '@/modules/practitioner-role/components/PractitionerRoleListPage'

interface PractitionerRolesSearch {
  practitioner_id?: string
  organisation_id?: string
}

export const Route = createFileRoute('/_auth/admin/practitioner-roles')({
  validateSearch: (raw: Record<string, unknown>): PractitionerRolesSearch => {
    const out: PractitionerRolesSearch = {}
    if (typeof raw['practitioner_id'] === 'string' && raw['practitioner_id'] !== '') {
      out.practitioner_id = raw['practitioner_id']
    }
    if (typeof raw['organisation_id'] === 'string' && raw['organisation_id'] !== '') {
      out.organisation_id = raw['organisation_id']
    }
    return out
  },
  component: PractitionerRoleListPage,
})
