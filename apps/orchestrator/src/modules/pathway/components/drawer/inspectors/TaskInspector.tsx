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

import { TASK_ASSIGNEES, type ConfigForSemantics } from '../../../configSchemas'

import { InspectorField } from './InspectorField'

type Props = {
  config: ConfigForSemantics<'task'>
  onChange: (next: ConfigForSemantics<'task'>) => void
}

// Synced to the typed `TaskBlock` shape: title + assignee
// (patient | caregiver) are required at publish; the legacy
// `description` field maps to `notes`.
export function TaskInspector({ config, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <div className="flex flex-col gap-3">
      <InspectorField label={t('inspector.task.title')} htmlFor="task-title">
        <Input
          id="task-title"
          value={config.title ?? ''}
          onChange={(e) => onChange({ ...config, title: e.target.value || undefined })}
          placeholder={t('inspector.task.titlePlaceholder')}
        />
      </InspectorField>
      <InspectorField label={t('inspector.task.assignee')}>
        <Select
          value={config.assignee ?? ''}
          onValueChange={(assignee) =>
            onChange({ ...config, assignee: assignee as (typeof TASK_ASSIGNEES)[number] })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('inspector.task.assigneePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {TASK_ASSIGNEES.map((assignee) => (
              <SelectItem key={assignee} value={assignee}>
                {t(`inspector.task.assigneeOption.${assignee}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InspectorField>
      <InspectorField label={t('inspector.task.dueOffset')} htmlFor="task-due-offset">
        <Input
          id="task-due-offset"
          type="number"
          min={0}
          value={config.due_offset_days ?? ''}
          onChange={(e) =>
            onChange({
              ...config,
              due_offset_days: e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
        />
      </InspectorField>
      <InspectorField label={t('inspector.task.notes')} htmlFor="task-notes">
        <Textarea
          id="task-notes"
          value={config.notes ?? ''}
          onChange={(e) => onChange({ ...config, notes: e.target.value || undefined })}
          placeholder={t('inspector.task.descriptionPlaceholder')}
        />
      </InspectorField>
    </div>
  )
}
