import { createFileRoute } from '@tanstack/react-router'

import { SectionPlaceholder } from '@/components/layout/SectionPlaceholder'

export const Route = createFileRoute('/_auth/patients')({
  component: () => <SectionPlaceholder titleKey="nav.patients" />,
})
