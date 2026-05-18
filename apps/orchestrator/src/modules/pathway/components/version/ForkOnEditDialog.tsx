import { useNavigate } from '@tanstack/react-router'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { useForkPathwayFromPublish } from '../../hooks'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pathwayId: string
  sourceVersionId: string
}

export function ForkOnEditDialog({
  open,
  onOpenChange,
  pathwayId,
  sourceVersionId,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const navigate = useNavigate()
  const fork = useForkPathwayFromPublish(pathwayId)

  function handleConfirm() {
    fork.mutate(
      { versionId: sourceVersionId },
      {
        onSuccess: () => {
          onOpenChange(false)
          void navigate({ to: '/pathways/$pathwayId', params: { pathwayId } })
        },
        onError: () => toast.error(t('forkOnEdit.error')),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('forkOnEdit.title')}</DialogTitle>
          <DialogDescription>{t('forkOnEdit.body')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={fork.isPending}
          >
            {t('forkOnEdit.cancel')}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={fork.isPending}>
            {t('forkOnEdit.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
