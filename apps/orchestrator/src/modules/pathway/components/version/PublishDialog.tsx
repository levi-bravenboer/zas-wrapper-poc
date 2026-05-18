import { useId, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { usePublishPathway } from '../../hooks'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pathwayId: string
}

export function PublishDialog({ open, onOpenChange, pathwayId }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const publish = usePublishPathway(pathwayId)
  const labelId = useId()
  const noteId = useId()
  const approvalId = useId()

  const [label, setLabel] = useState('')
  const [note, setNote] = useState('')
  const [approved, setApproved] = useState(false)

  function reset() {
    setLabel('')
    setNote('')
    setApproved(false)
    publish.reset()
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) reset()
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!approved) return
    publish.mutate(
      {
        label: label.trim() || null,
        note: note.trim() || null,
        clinically_approved: true,
      },
      {
        onSuccess: (versionSummary) => {
          toast.success(t('publish.modal.success', { n: versionSummary.version_no }))
          handleOpenChange(false)
        },
        onError: () => toast.error(t('publish.modal.error')),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{t('publish.modal.title')}</DialogTitle>
            <DialogDescription className="sr-only">{t('publish.modal.title')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={labelId}>{t('publish.modal.labelLabel')}</Label>
              <Input
                id={labelId}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t('publish.modal.labelPlaceholder')}
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={noteId}>{t('publish.modal.noteLabel')}</Label>
              <Textarea
                id={noteId}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('publish.modal.notePlaceholder')}
                maxLength={2000}
                rows={3}
              />
            </div>
            <label htmlFor={approvalId} className="flex items-center gap-2 text-sm">
              <Checkbox
                id={approvalId}
                checked={approved}
                onCheckedChange={(v) => setApproved(v === true)}
              />
              <span>{t('publish.modal.approval')}</span>
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={publish.isPending}
            >
              {t('publish.modal.cancel')}
            </Button>
            <Button type="submit" disabled={!approved || publish.isPending}>
              {t('publish.modal.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
