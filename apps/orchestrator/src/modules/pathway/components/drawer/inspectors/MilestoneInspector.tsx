import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Textarea } from '@/components/ui/textarea'

import type { ConfigForSemantics } from '../../../configSchemas'

import { InspectorField } from './InspectorField'

type Props = {
  config: ConfigForSemantics<'milestone'>
  onChange: (next: ConfigForSemantics<'milestone'>) => void
}

export function MilestoneInspector({ config, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <InspectorField label={t('inspector.milestone.note')} htmlFor="milestone-note">
      <Textarea
        id="milestone-note"
        value={config.note ?? ''}
        onChange={(e) => onChange({ ...config, note: e.target.value || undefined })}
        placeholder={t('inspector.milestone.notePlaceholder')}
      />
    </InspectorField>
  )
}
