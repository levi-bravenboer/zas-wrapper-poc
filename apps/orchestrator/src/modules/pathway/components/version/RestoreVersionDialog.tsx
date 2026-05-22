import { useQueryClient } from '@tanstack/react-query'
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

import { useRestorePathwayVersion } from '../../hooks'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pathwayId: string
  versionId: string
  versionNo: number
  onAfterRestore?: () => void
}

export function RestoreVersionDialog({
  open,
  onOpenChange,
  pathwayId,
  versionId,
  versionNo,
  onAfterRestore,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const qc = useQueryClient()
  const restore = useRestorePathwayVersion(pathwayId)

  function handleConfirm() {
    restore.mutate(
      { versionId },
      {
        onSuccess: () => {
          toast.success(t('history.restore.success'))
          void qc.invalidateQueries({ queryKey: ['pathway'] })
          onOpenChange(false)
          onAfterRestore?.()
        },
        onError: () => toast.error(t('history.restore.error')),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('history.restore.title')}</DialogTitle>
          <DialogDescription>{t('history.restore.body', { n: versionNo })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={restore.isPending}
          >
            {t('history.restore.cancel')}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={restore.isPending}>
            {t('history.restore.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
