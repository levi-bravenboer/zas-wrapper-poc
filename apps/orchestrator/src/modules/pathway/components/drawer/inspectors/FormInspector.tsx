import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { ReactElement } from 'react'
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
import { Switch } from '@/components/ui/switch'

import {
  FORM_QUESTION_TYPES,
  type ConfigForSemantics,
  type FormQuestion,
} from '../../../configSchemas'

import { InspectorField } from './InspectorField'

type Props = {
  config: ConfigForSemantics<'form'>
  onChange: (next: ConfigForSemantics<'form'>) => void
}

const CHOICE_TYPES: ReadonlyArray<FormQuestion['type']> = ['single_choice', 'multi_choice']

function isChoiceType(t: FormQuestion['type']): boolean {
  return CHOICE_TYPES.includes(t)
}

export function FormInspector({ config, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const questions = config.questions ?? []

  function setQuestions(next: FormQuestion[]) {
    onChange({ ...config, questions: next })
  }

  function addQuestion() {
    const q: FormQuestion = {
      id: crypto.randomUUID(),
      type: 'text',
      label: '',
      required: false,
    }
    setQuestions([...questions, q])
  }

  function patchQuestion(id: string, patch: Partial<FormQuestion>) {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  }

  function removeQuestion(id: string) {
    setQuestions(questions.filter((q) => q.id !== id))
  }

  function moveQuestion(id: string, dir: -1 | 1) {
    const idx = questions.findIndex((q) => q.id === id)
    if (idx < 0) return
    const target = idx + dir
    if (target < 0 || target >= questions.length) return
    const next = [...questions]
    const a = next[idx]
    const b = next[target]
    if (!a || !b) return
    next[idx] = b
    next[target] = a
    setQuestions(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t('inspector.form.questions')}
        </h4>
        <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
          <Plus className="size-4" />
          {t('inspector.form.addQuestion')}
        </Button>
      </div>

      {questions.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('inspector.form.empty')}</p>
      )}

      {questions.map((q, i) => (
        <div
          key={q.id}
          className="flex flex-col gap-2 rounded-md border border-input bg-muted/20 p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">
              {t('inspector.form.questionN', { n: i + 1 })}
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => moveQuestion(q.id, -1)}
                disabled={i === 0}
                aria-label={t('inspector.form.moveUp')}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => moveQuestion(q.id, 1)}
                disabled={i === questions.length - 1}
                aria-label={t('inspector.form.moveDown')}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeQuestion(q.id)}
                aria-label={t('inspector.form.remove')}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          <InspectorField label={t('inspector.form.label')}>
            <Input
              value={q.label}
              onChange={(e) => patchQuestion(q.id, { label: e.target.value })}
              placeholder={t('inspector.form.labelPlaceholder')}
            />
          </InspectorField>

          <InspectorField label={t('inspector.form.type')}>
            <Select
              value={q.type}
              onValueChange={(v) => patchQuestion(q.id, { type: v as FormQuestion['type'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORM_QUESTION_TYPES.map((qt) => (
                  <SelectItem key={qt} value={qt}>
                    {t(`inspector.form.typeOption.${qt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </InspectorField>

          {isChoiceType(q.type) && (
            <InspectorField
              label={t('inspector.form.options')}
              hint={t('inspector.form.optionsHint')}
            >
              <Input
                value={(q.options ?? []).join(', ')}
                onChange={(e) =>
                  patchQuestion(q.id, {
                    options: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder={t('inspector.form.optionsPlaceholder')}
              />
            </InspectorField>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-sm text-foreground">{t('inspector.form.required')}</span>
            <Switch
              checked={q.required}
              onCheckedChange={(checked) => patchQuestion(q.id, { required: checked })}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
