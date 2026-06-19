import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface TreatmentResultDraft {
  performed_at: string
  notes: string | null
  complications: string | null
}

export interface TreatmentActionProps {
  disabled: boolean
  onConfirm: (result: TreatmentResultDraft) => void
}

// Treatment completion (TreatmentResult): performed date + optional notes
// and complications. `performed_at` is sent as a full ISO datetime.
export function TreatmentAction({ disabled, onConfirm }: TreatmentActionProps): ReactElement {
  const { t } = useTranslation('patient-pathway')
  const [open, setOpen] = useState(false)
  const [performedAt, setPerformedAt] = useState(todayIso)
  const [notes, setNotes] = useState('')
  const [complications, setComplications] = useState('')

  const confirm = (): void => {
    onConfirm({
      performed_at: new Date(performedAt).toISOString(),
      notes: notes.trim() === '' ? null : notes.trim(),
      complications: complications.trim() === '' ? null : complications.trim(),
    })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" disabled={disabled}>
          {t('step.treatment.open')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-72 flex-col gap-2">
        <Label htmlFor="treatment-performed">{t('step.treatment.performedAt')}</Label>
        <Input
          id="treatment-performed"
          type="date"
          value={performedAt}
          onChange={(e) => setPerformedAt(e.target.value)}
        />
        <Label htmlFor="treatment-notes">{t('step.treatment.notes')}</Label>
        <Textarea
          id="treatment-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('step.treatment.notesPlaceholder')}
        />
        <Label htmlFor="treatment-complications">{t('step.treatment.complications')}</Label>
        <Textarea
          id="treatment-complications"
          value={complications}
          onChange={(e) => setComplications(e.target.value)}
          placeholder={t('step.treatment.complicationsPlaceholder')}
        />
        <Button size="sm" disabled={disabled || performedAt === ''} onClick={confirm}>
          {t('step.treatment.confirm')}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
