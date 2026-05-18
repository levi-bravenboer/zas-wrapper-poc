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

import { WAIT_EVENT_TYPES, WAIT_ON_TIMEOUT, type ConfigForSemantics } from '../../../configSchemas'
import type { PathwayBlock } from '../../../types'

import { InspectorField } from './InspectorField'

type Props = {
  config: ConfigForSemantics<'wait'>
  blocks: PathwayBlock[]
  currentBlockId: string
  onChange: (next: ConfigForSemantics<'wait'>) => void
}

export function WaitInspector({ config, blocks, currentBlockId, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const otherBlocks = blocks.filter((b) => b.id !== currentBlockId)

  return (
    <div className="flex flex-col gap-3">
      <InspectorField label={t('inspector.wait.eventType')}>
        <Select
          value={config.event_type ?? ''}
          onValueChange={(v) =>
            onChange({
              ...config,
              event_type: (v || undefined) as ConfigForSemantics<'wait'>['event_type'],
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('inspector.wait.eventTypePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {WAIT_EVENT_TYPES.map((e) => (
              <SelectItem key={e} value={e}>
                {t(`eventType.${e}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InspectorField>

      <InspectorField label={t('inspector.wait.timeoutDays')} htmlFor="wait-timeout">
        <Input
          id="wait-timeout"
          type="number"
          min={1}
          step={1}
          value={config.timeout_days ?? ''}
          onChange={(e) => {
            const raw = e.target.value
            if (!raw) {
              onChange({ ...config, timeout_days: undefined })
              return
            }
            const n = Number(raw)
            if (!Number.isInteger(n) || n <= 0) return
            onChange({ ...config, timeout_days: n })
          }}
        />
      </InspectorField>

      <InspectorField label={t('inspector.wait.onTimeout')}>
        <Select
          value={config.on_timeout ?? ''}
          onValueChange={(v) =>
            onChange({
              ...config,
              on_timeout: (v || undefined) as ConfigForSemantics<'wait'>['on_timeout'],
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('inspector.wait.onTimeoutPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {WAIT_ON_TIMEOUT.map((o) => (
              <SelectItem key={o} value={o}>
                {t(`inspector.wait.onTimeoutOption.${o}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InspectorField>

      <InspectorField
        label={t('inspector.wait.sourceBlock')}
        hint={t('inspector.wait.sourceBlockHint')}
      >
        <Select
          value={config.source_block_id ?? ''}
          onValueChange={(v) => onChange({ ...config, source_block_id: v || undefined })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('inspector.wait.sourceBlockPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {otherBlocks.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {t('inspector.wait.noOtherBlocks')}
              </div>
            ) : (
              otherBlocks.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.label ?? t(`blockType.${b.type}`, { defaultValue: b.type })}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </InspectorField>
    </div>
  )
}
