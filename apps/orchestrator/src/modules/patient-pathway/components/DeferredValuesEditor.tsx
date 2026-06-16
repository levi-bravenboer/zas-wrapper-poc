import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { usePatchDeferredValue } from '../hooks'
import type { BlockExecution, Enrollment } from '../types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function consumed(state: BlockExecution['state'] | undefined): boolean {
  return state === 'completed' || state === 'skipped'
}

export interface DeferredValuesEditorProps {
  patientId: string
  enrollment: Enrollment
}

// §6.6: edit still-updatable enrollment values (named clinical dates,
// deferred values). A value whose owning block has already completed is
// locked. Editing a clinical date recomputes its dependent timers backend-side.
export function DeferredValuesEditor({
  patientId,
  enrollment,
}: DeferredValuesEditorProps): ReactElement | null {
  const { t } = useTranslation('patient-pathway')
  const patch = usePatchDeferredValue(patientId)

  const values = enrollment.deferred_values ?? []
  if (values.length === 0) return null

  const stateByBlock = new Map<string, BlockExecution['state']>()
  for (const execution of enrollment.executions ?? []) {
    stateByBlock.set(execution.block_template_id, execution.state)
  }

  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('values.header')}
      </h4>
      <div className="flex flex-col gap-3">
        {values.map((value) => (
          <ValueRow
            key={value.id}
            attr={value.attr}
            initial={typeof value.value_json === 'string' ? value.value_json : ''}
            locked={consumed(stateByBlock.get(value.block_template_id))}
            saving={patch.isPending}
            onSave={(next) =>
              patch.mutate(
                {
                  enrollmentId: enrollment.id,
                  attr: value.attr,
                  blockTemplateId: value.block_template_id,
                  valueJson: next,
                },
                {
                  onSuccess: () => toast.success(t('values.toast.success')),
                  onError: () => toast.error(t('values.toast.error')),
                },
              )
            }
          />
        ))}
      </div>
    </section>
  )
}

interface ValueRowProps {
  attr: string
  initial: string
  locked: boolean
  saving: boolean
  onSave: (next: string) => void
}

function ValueRow({ attr, initial, locked, saving, onSave }: ValueRowProps): ReactElement {
  const { t } = useTranslation('patient-pathway')
  const [draft, setDraft] = useState(initial)
  const dirty = draft !== initial && draft.trim() !== ''

  return (
    <div className="flex items-end gap-2">
      <div className="flex flex-1 flex-col gap-1">
        <Label htmlFor={`value-${attr}`} className="text-xs text-muted-foreground">
          {attr}
        </Label>
        <Input
          id={`value-${attr}`}
          type={ISO_DATE.test(initial) ? 'date' : 'text'}
          value={draft}
          disabled={locked}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>
      {locked ? (
        <span className="pb-2 text-xs text-muted-foreground">{t('values.locked')}</span>
      ) : (
        <Button size="sm" disabled={!dirty || saving} onClick={() => onSave(draft)}>
          {t('values.save')}
        </Button>
      )}
    </div>
  )
}
