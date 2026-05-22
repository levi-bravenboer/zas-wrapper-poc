import { createFileRoute } from '@tanstack/react-router'

import { tasksFeature } from '@/modules/tasks'
import { renderFeature } from '@/platform/embed/renderFeature'

export const Route = createFileRoute('/_auth/tasks')({
  component: () => renderFeature(tasksFeature),
})
