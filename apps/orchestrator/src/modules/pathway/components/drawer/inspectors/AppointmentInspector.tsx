import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { APPOINTMENT_MODES, type ConfigForSemantics } from '../../../configSchemas'

import { InspectorField } from './InspectorField'

type Props = {
  config: ConfigForSemantics<'appointment'>
  onChange: (next: ConfigForSemantics<'appointment'>) => void
}

// Synced to the typed `AppointmentBlock` shape (title required at
// publish; mode is the in_person | video | phone enum — the legacy
// free-text `kind` field is retired).
export function AppointmentInspector({ config, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <div className="flex flex-col gap-3">
      <InspectorField label={t('inspector.appointment.title')} htmlFor="appt-title">
        <Input
          id="appt-title"
          value={config.title ?? ''}
          onChange={(e) => onChange({ ...config, title: e.target.value || undefined })}
          placeholder={t('inspector.appointment.titlePlaceholder')}
        />
      </InspectorField>
      <InspectorField label={t('inspector.appointment.mode')}>
        <Select
          value={config.mode ?? ''}
          onValueChange={(mode) =>
            onChange({ ...config, mode: mode as (typeof APPOINTMENT_MODES)[number] })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('inspector.appointment.modePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {APPOINTMENT_MODES.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {t(`inspector.appointment.modeOption.${mode}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InspectorField>
      <InspectorField label={t('inspector.appointment.location')} htmlFor="appt-location">
        <Input
          id="appt-location"
          value={config.location ?? ''}
          onChange={(e) => onChange({ ...config, location: e.target.value || undefined })}
          placeholder={t('inspector.appointment.locationPlaceholder')}
        />
      </InspectorField>
      <InspectorField label={t('inspector.appointment.duration')} htmlFor="appt-duration">
        <Input
          id="appt-duration"
          type="number"
          min={0}
          value={config.duration_minutes ?? ''}
          onChange={(e) =>
            onChange({
              ...config,
              duration_minutes: e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
        />
      </InspectorField>
      <InspectorField label={t('inspector.appointment.notes')} htmlFor="appt-notes">
        <Textarea
          id="appt-notes"
          value={config.notes ?? ''}
          onChange={(e) => onChange({ ...config, notes: e.target.value || undefined })}
        />
      </InspectorField>
    </div>
  )
}
