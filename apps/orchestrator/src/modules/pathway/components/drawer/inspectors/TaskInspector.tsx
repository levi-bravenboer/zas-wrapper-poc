import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import type { ConfigForSemantics } from '../../../configSchemas'

import { InspectorField } from './InspectorField'

type Props = {
  config: ConfigForSemantics<'task'>
  onChange: (next: ConfigForSemantics<'task'>) => void
}

const ASSIGNEES = ['caregiver', 'admin'] as const

export function TaskInspector({ config, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <div className="flex flex-col gap-3">
      <InspectorField label={t('inspector.task.assignee')}>
        <Select
          value={config.assignee ?? ''}
          onValueChange={(v) => onChange({ ...config, assignee: v || undefined })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('inspector.task.assigneePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {ASSIGNEES.map((a) => (
              <SelectItem key={a} value={a}>
                {t(`inspector.task.assigneeOption.${a}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InspectorField>
      <InspectorField label={t('inspector.task.description')} htmlFor="task-desc">
        <Textarea
          id="task-desc"
          value={config.description ?? ''}
          onChange={(e) => onChange({ ...config, description: e.target.value || undefined })}
          placeholder={t('inspector.task.descriptionPlaceholder')}
        />
      </InspectorField>
    </div>
  )
}
