import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import type { ConfigForSemantics } from '../../../configSchemas'

import { InspectorField } from './InspectorField'

type Props = {
  config: ConfigForSemantics<'treatment'>
  onChange: (next: ConfigForSemantics<'treatment'>) => void
}

// Pathway-completion § A4: executed clinical procedure. `notes` is the
// SOP / preparation guidance shown to the caregiver.
export function TreatmentInspector({ config, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <div className="flex flex-col gap-3">
      <InspectorField label={t('inspector.treatment.title')} htmlFor="treatment-title">
        <Input
          id="treatment-title"
          value={config.title ?? ''}
          onChange={(e) => onChange({ ...config, title: e.target.value || undefined })}
          placeholder={t('inspector.treatment.titlePlaceholder')}
        />
      </InspectorField>
      <InspectorField label={t('inspector.treatment.location')} htmlFor="treatment-location">
        <Input
          id="treatment-location"
          value={config.location ?? ''}
          onChange={(e) => onChange({ ...config, location: e.target.value || undefined })}
          placeholder={t('inspector.treatment.locationPlaceholder')}
        />
      </InspectorField>
      <InspectorField label={t('inspector.treatment.duration')} htmlFor="treatment-duration">
        <Input
          id="treatment-duration"
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
      <InspectorField label={t('inspector.treatment.notes')} htmlFor="treatment-notes">
        <Textarea
          id="treatment-notes"
          value={config.notes ?? ''}
          onChange={(e) => onChange({ ...config, notes: e.target.value || undefined })}
          placeholder={t('inspector.treatment.notesPlaceholder')}
        />
      </InspectorField>
    </div>
  )
}
