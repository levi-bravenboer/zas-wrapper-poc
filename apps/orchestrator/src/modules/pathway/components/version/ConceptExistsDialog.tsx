import { useNavigate } from '@tanstack/react-router'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pathwayId: string
  conceptVersionNo: number | null
}

export function ConceptExistsDialog({
  open,
  onOpenChange,
  pathwayId,
  conceptVersionNo,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const navigate = useNavigate()

  function handleOpenExisting() {
    onOpenChange(false)
    void navigate({ to: '/pathways/$pathwayId', params: { pathwayId } })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('history.conceptExists.title')}</DialogTitle>
          <DialogDescription>
            {t('history.conceptExists.body', { n: conceptVersionNo ?? '?' })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('history.conceptExists.cancel')}
          </Button>
          <Button type="button" onClick={handleOpenExisting}>
            {t('history.conceptExists.open')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
