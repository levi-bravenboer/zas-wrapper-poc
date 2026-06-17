import { Plus, X } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
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
// free-text for who to invite. Optional authored `outcomes` are picked
// by the chair at close (§6b.5).
export function MdoInspector({ config, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const outcomes = config.outcomes ?? []
  const [pendingOutcome, setPendingOutcome] = useState('')

  function addOutcome() {
    const value = pendingOutcome.trim()
    if (!value || outcomes.includes(value)) return
    onChange({ ...config, outcomes: [...outcomes, value] })
    setPendingOutcome('')
  }

  function removeOutcome(value: string) {
    onChange({ ...config, outcomes: outcomes.filter((o) => o !== value) })
  }

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
      <InspectorField
        label={t('inspector.mdo.outcomes', { defaultValue: 'Uitkomsten' })}
        hint={t('inspector.mdo.outcomesHint', {
          defaultValue: 'Optioneel — de voorzitter kiest één uitkomst bij afsluiten.',
        })}
      >
        <div className="flex flex-col gap-2">
          {outcomes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {outcomes.map((outcome) => (
                <span
                  key={outcome}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-0.5 text-[12px]"
                >
                  {outcome}
                  <button
                    type="button"
                    aria-label={t('inspector.mdo.removeOutcome', {
                      defaultValue: 'Uitkomst verwijderen',
                    })}
                    onClick={() => removeOutcome(outcome)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Input
              aria-label={t('inspector.mdo.newOutcome', { defaultValue: 'Nieuwe uitkomst' })}
              value={pendingOutcome}
              placeholder={t('inspector.mdo.newOutcomePlaceholder', {
                defaultValue: 'bijv. operatie',
              })}
              onChange={(e) => setPendingOutcome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addOutcome()
                }
              }}
              className="h-8 text-[12px]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOutcome}
              disabled={!pendingOutcome.trim()}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>
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
