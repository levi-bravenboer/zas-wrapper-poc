import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import type { ConfigForSemantics } from '../../../configSchemas'

import { InspectorField } from './InspectorField'

type Props = {
  config: ConfigForSemantics<'mdo'>
  onChange: (next: ConfigForSemantics<'mdo'>) => void
}

// Pathway-completion § A7: multi-disciplinair overleg. One leading
// caregiver chairs (bound at runtime); the attendees note is advisory
// free-text for who to invite.
export function MdoInspector({ config, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <div className="flex flex-col gap-3">
      <InspectorField
        label={t('inspector.mdo.topic', { defaultValue: 'Onderwerp' })}
        htmlFor="mdo-topic"
      >
        <Input
          id="mdo-topic"
          value={config.topic ?? ''}
          onChange={(e) => onChange({ ...config, topic: e.target.value || undefined })}
          placeholder={t('inspector.mdo.topicPlaceholder', {
            defaultValue: 'Bijv. Bespreking pathologie-uitslag',
          })}
        />
      </InspectorField>
      <InspectorField
        label={t('inspector.mdo.attendeesNote', { defaultValue: 'Verwachte deelnemers' })}
        htmlFor="mdo-attendees"
      >
        <Textarea
          id="mdo-attendees"
          value={config.expected_attendees_note ?? ''}
          onChange={(e) =>
            onChange({ ...config, expected_attendees_note: e.target.value || undefined })
          }
          placeholder={t('inspector.mdo.attendeesNotePlaceholder', {
            defaultValue: 'Bijv. oncoloog + radioloog + chirurg (advies, vrij invulbaar)',
          })}
        />
      </InspectorField>
      <p className="text-[11px] text-muted-foreground">
        {t('inspector.mdo.leadingHint', {
          defaultValue:
            'De hoofdbehandelaar van de patiënt zit het MDO voor en sluit het af; extra zorgverleners kunnen onbeperkt bijdragen.',
        })}
      </p>
    </div>
  )
}
