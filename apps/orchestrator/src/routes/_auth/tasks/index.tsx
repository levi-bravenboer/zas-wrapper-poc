// surface-opt-out: app-only
import { createFileRoute } from '@tanstack/react-router'
import { Inbox } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/states/EmptyState'

export const Route = createFileRoute('/_auth/tasks/')({
  component: TasksIndexRoute,
})

function TasksIndexRoute(): ReactElement {
  const { t } = useTranslation(['tasks'])
  return (
    <div className="flex h-full items-center justify-center p-8">
      <EmptyState
        icon={Inbox}
        title={t('tasks:selection.title')}
        body={t('tasks:selection.body')}
      />
    </div>
  )
}
