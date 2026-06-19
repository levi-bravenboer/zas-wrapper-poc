import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export interface MdoResultDraft {
  contributors: string[]
  notes: string
  closed_at: string
  outcome?: string
}

export interface MdoActionProps {
  disabled: boolean
  outcomes: string[]
  onConfirm: (result: MdoResultDraft) => void
}

// Leading caregiver closes the MDO with notes + an optional authored outcome.
// `contributors` binds at runtime (out of PoC), so it is submitted empty here;
// the backend `MdoResult` accepts an empty contributor list.
export function MdoAction({ disabled, outcomes, onConfirm }: MdoActionProps): ReactElement {
  const { t } = useTranslation('patient-pathway')
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [outcome, setOutcome] = useState('')

  const needsOutcome = outcomes.length > 0
  const confirm = (): void => {
    onConfirm({
      contributors: [],
      notes: notes.trim(),
      closed_at: new Date().toISOString(),
      ...(outcome !== '' ? { outcome } : {}),
    })
    setOpen(false)
    setNotes('')
    setOutcome('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" disabled={disabled}>
          {t('step.mdo.open')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-72 flex-col gap-2">
        {needsOutcome ? (
          <>
            <Label htmlFor="mdo-outcome">{t('step.mdo.outcomeLabel')}</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger id="mdo-outcome">
                <SelectValue placeholder={t('step.mdo.outcomePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {outcomes.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}
        <Label htmlFor="mdo-notes">{t('step.mdo.notesLabel')}</Label>
        <Textarea
          id="mdo-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('step.mdo.notesPlaceholder')}
        />
        <Button size="sm" disabled={disabled || (needsOutcome && outcome === '')} onClick={confirm}>
          {t('step.mdo.confirm')}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
