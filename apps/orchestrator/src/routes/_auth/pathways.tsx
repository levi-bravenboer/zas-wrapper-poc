import { createFileRoute } from '@tanstack/react-router'

import { SectionPlaceholder } from '@/components/layout/SectionPlaceholder'

export const Route = createFileRoute('/_auth/pathways')({
  component: () => <SectionPlaceholder titleKey="nav.pathways" />,
})
