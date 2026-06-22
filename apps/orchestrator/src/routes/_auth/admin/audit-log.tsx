// surface-opt-out: app-only
import { createFileRoute } from '@tanstack/react-router'

import { AuditListPage } from '@/modules/audit/components/AuditListPage'

export const Route = createFileRoute('/_auth/admin/audit-log')({
  component: AuditListPage,
  staticData: { breadcrumb: 'header.crumb.auditLog' },
})
