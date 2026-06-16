import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'

export interface MdoActionProps {
  disabled: boolean
  onConfirm: (result: { contributors: string[]; notes: string; closed_at: string }) => void
}

// Leading caregiver closes the MDO with notes. `contributors` binds at
// runtime (out of PoC), so it is submitted empty here; the backend
// `MdoResult` accepts an empty contributor list.
export function MdoAction({ disabled, onConfirm }: MdoActionProps): ReactElement {
  const { t } = useTranslation('patient-pathway')
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')

  const confirm = (): void => {
    onConfirm({ contributors: [], notes: notes.trim(), closed_at: new Date().toISOString() })
    setOpen(false)
    setNotes('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" disabled={disabled}>
          {t('step.mdo.open')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-72 flex-col gap-2">
        <Label htmlFor="mdo-notes">{t('step.mdo.notesLabel')}</Label>
        <Textarea
          id="mdo-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('step.mdo.notesPlaceholder')}
        />
        <Button size="sm" disabled={disabled} onClick={confirm}>
          {t('step.mdo.confirm')}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
