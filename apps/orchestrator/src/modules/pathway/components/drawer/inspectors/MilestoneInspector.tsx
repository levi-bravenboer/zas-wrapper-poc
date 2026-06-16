import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import type { ConfigForSemantics } from '../../../configSchemas'

import { InspectorField } from './InspectorField'

type Props = {
  config: ConfigForSemantics<'milestone'>
  onChange: (next: ConfigForSemantics<'milestone'>) => void
}

// Synced to the typed `MilestoneBlock` shape (label required at
// publish; the legacy free-text `note` field is retired).
export function MilestoneInspector({ config, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <div className="flex flex-col gap-3">
      <InspectorField
        label={t('inspector.milestone.label', { defaultValue: 'Label' })}
        htmlFor="milestone-label"
      >
        <Input
          id="milestone-label"
          value={config.label ?? ''}
          onChange={(e) => onChange({ ...config, label: e.target.value || undefined })}
          placeholder={t('inspector.milestone.labelPlaceholder', {
            defaultValue: 'Bijv. Operatie afgerond',
          })}
        />
      </InspectorField>
      <InspectorField
        label={t('inspector.milestone.description', { defaultValue: 'Omschrijving' })}
        htmlFor="milestone-description"
      >
        <Textarea
          id="milestone-description"
          value={config.description ?? ''}
          onChange={(e) => onChange({ ...config, description: e.target.value || undefined })}
        />
      </InspectorField>
    </div>
  )
}
