import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'

import type { ConfigForSemantics } from '../../../configSchemas'

import { InspectorField } from './InspectorField'

type Props = {
  config: ConfigForSemantics<'appointment'>
  onChange: (next: ConfigForSemantics<'appointment'>) => void
}

export function AppointmentInspector({ config, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <div className="flex flex-col gap-3">
      <InspectorField label={t('inspector.appointment.kind')} htmlFor="appt-kind">
        <Input
          id="appt-kind"
          value={config.kind ?? ''}
          onChange={(e) => onChange({ ...config, kind: e.target.value || undefined })}
          placeholder={t('inspector.appointment.kindPlaceholder')}
        />
      </InspectorField>
      <InspectorField label={t('inspector.appointment.location')} htmlFor="appt-location">
        <Input
          id="appt-location"
          value={config.location ?? ''}
          onChange={(e) => onChange({ ...config, location: e.target.value || undefined })}
          placeholder={t('inspector.appointment.locationPlaceholder')}
        />
      </InspectorField>
    </div>
  )
}
