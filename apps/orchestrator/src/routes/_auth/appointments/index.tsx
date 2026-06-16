// surface-opt-out: app-only
import { createFileRoute } from '@tanstack/react-router'
import { Calendar } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { RailSelectionEmptyState } from '@/components/rail'

export const Route = createFileRoute('/_auth/appointments/')({
  component: AppointmentsIndexRoute,
})

function AppointmentsIndexRoute(): ReactElement {
  const { t } = useTranslation(['appointment'])
  return (
    <div className="flex h-full items-center justify-center p-8">
      <RailSelectionEmptyState
        icon={<Calendar className="size-6" />}
        title={t('appointment:selection.title', { defaultValue: 'Selecteer een afspraak' })}
        body={t('appointment:selection.body', {
          defaultValue: 'Kies links een afspraak om details te bekijken.',
        })}
      />
    </div>
  )
}
