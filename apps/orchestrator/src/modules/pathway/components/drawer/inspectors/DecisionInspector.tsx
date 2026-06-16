import { Plus, X } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { DECISION_MODES, type ConfigForSemantics } from '../../../configSchemas'

import { InspectorField } from './InspectorField'

type Props = {
  config: ConfigForSemantics<'decision'>
  onChange: (next: ConfigForSemantics<'decision'>) => void
}

// Slot #2 §5 / pathway-completion § C4: the decision declares its
// `question` + typed `outputs` (the keys downstream blocks gate on via
// `decision_output(decision_id, output_key)`) + firing `mode`. It does
// NOT name downstream blocks — wiring lives on the downstream block's
// input_logic.
export function DecisionInspector({ config, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const outputs = config.outputs ?? []
  const [pendingOutput, setPendingOutput] = useState('')

  function addOutput() {
    const value = pendingOutput.trim()
    if (!value || outputs.includes(value)) return
    onChange({ ...config, outputs: [...outputs, value] })
    setPendingOutput('')
  }

  function removeOutput(value: string) {
    onChange({ ...config, outputs: outputs.filter((o) => o !== value) })
  }

  return (
    <div className="flex flex-col gap-3">
      <InspectorField
        label={t('inspector.decision.question', { defaultValue: 'Vraag' })}
        htmlFor="decision-question"
      >
        <Textarea
          id="decision-question"
          value={config.question ?? ''}
          onChange={(e) => onChange({ ...config, question: e.target.value || undefined })}
          placeholder={t('inspector.decision.questionPlaceholder', {
            defaultValue: 'Bijv. Verloopt het herstel volgens plan?',
          })}
        />
      </InspectorField>

      <InspectorField
        label={t('inspector.decision.outputs', { defaultValue: 'Uitkomsten' })}
        hint={t('inspector.decision.outputsHint', {
          defaultValue: 'Volgende blokken verwijzen naar deze uitkomsten via hun bedrijfslogica.',
        })}
      >
        <div className="flex flex-col gap-2">
          {outputs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {outputs.map((output) => (
                <span
                  key={output}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-0.5 text-[12px]"
                >
                  {output}
                  <button
                    type="button"
                    aria-label={t('inspector.decision.removeOutput', {
                      defaultValue: 'Uitkomst verwijderen',
                    })}
                    onClick={() => removeOutput(output)}
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
              aria-label={t('inspector.decision.newOutput', {
                defaultValue: 'Nieuwe uitkomst',
              })}
              value={pendingOutput}
              placeholder={t('inspector.decision.newOutputPlaceholder', {
                defaultValue: 'bijv. goed',
              })}
              onChange={(e) => setPendingOutput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addOutput()
                }
              }}
              className="h-8 text-[12px]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOutput}
              disabled={!pendingOutput.trim()}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>
      </InspectorField>

      <InspectorField label={t('inspector.decision.mode', { defaultValue: 'Modus' })}>
        <Select
          value={config.mode ?? 'xor'}
          onValueChange={(mode) =>
            onChange({ ...config, mode: mode as (typeof DECISION_MODES)[number] })
          }
        >
          <SelectTrigger className="h-8 text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="xor">
              {t('inspector.decision.modeOption.xor', {
                defaultValue: 'XOR — precies één uitkomst vuurt',
              })}
            </SelectItem>
            <SelectItem value="and">
              {t('inspector.decision.modeOption.and', {
                defaultValue: 'AND — uitkomsten kunnen samen vuren',
              })}
            </SelectItem>
          </SelectContent>
        </Select>
      </InspectorField>
    </div>
  )
}
