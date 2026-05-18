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

import { MESSAGE_CHANNELS, type ConfigForSemantics } from '../../../configSchemas'

import { InspectorField } from './InspectorField'

type Props = {
  config: ConfigForSemantics<'message'>
  onChange: (next: ConfigForSemantics<'message'>) => void
}

export function MessageInspector({ config, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <div className="flex flex-col gap-3">
      <InspectorField label={t('inspector.message.channel')}>
        <Select
          value={config.channel ?? ''}
          onValueChange={(v) =>
            onChange({
              ...config,
              channel: (v || undefined) as ConfigForSemantics<'message'>['channel'],
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('inspector.message.channelPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {MESSAGE_CHANNELS.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`inspector.message.channelOption.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InspectorField>
      <InspectorField label={t('inspector.message.subject')} htmlFor="msg-subject">
        <Input
          id="msg-subject"
          value={config.subject ?? ''}
          onChange={(e) => onChange({ ...config, subject: e.target.value || undefined })}
          placeholder={t('inspector.message.subjectPlaceholder')}
        />
      </InspectorField>
      <InspectorField label={t('inspector.message.body')} htmlFor="msg-body">
        <Textarea
          id="msg-body"
          value={config.body ?? ''}
          onChange={(e) => onChange({ ...config, body: e.target.value || undefined })}
          placeholder={t('inspector.message.bodyPlaceholder')}
          className="min-h-[120px]"
        />
      </InspectorField>
      <InspectorField label={t('inspector.message.ctaLabel')} htmlFor="msg-cta-label">
        <Input
          id="msg-cta-label"
          value={config.cta_label ?? ''}
          onChange={(e) => onChange({ ...config, cta_label: e.target.value || undefined })}
          placeholder={t('inspector.message.ctaLabelPlaceholder')}
        />
      </InspectorField>
      <InspectorField label={t('inspector.message.ctaTarget')} htmlFor="msg-cta-target">
        <Input
          id="msg-cta-target"
          value={config.cta_target ?? ''}
          onChange={(e) => onChange({ ...config, cta_target: e.target.value || undefined })}
          placeholder={t('inspector.message.ctaTargetPlaceholder')}
        />
      </InspectorField>
    </div>
  )
}
