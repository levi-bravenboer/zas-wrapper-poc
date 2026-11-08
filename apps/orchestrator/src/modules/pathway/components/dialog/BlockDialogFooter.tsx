import { Trash2 } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'

import type { BlockDialogMode } from '../../types'

type Props = {
  mode: BlockDialogMode
  canSubmit: boolean
  showDelete: boolean
  onSubmit: () => void
  onCancel: () => void
  onDelete?: (() => void) | undefined
}

// Footer for BlockDialog (see `getBlockEditingFeatures.deletable`).
export function BlockDialogFooter({
  mode,
  canSubmit,
  showDelete,
  onSubmit,
  onCancel,
  onDelete,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <DialogFooter
      className="flex-row items-center border-t px-5 py-3"
      style={{ borderColor: 'var(--hairline)' }}
    >
      {mode === 'edit' && showDelete && onDelete && (
        <Button
          type="button"
          variant="ghost"
          onClick={onDelete}
          className="mr-auto text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" />
          {t('drawer.delete')}
        </Button>
      )}
      <Button type="button" variant="outline" onClick={onCancel}>
        {t('blockDialog.cancel')}
      </Button>
      <Button type="button" disabled={!canSubmit} onClick={onSubmit}>
        {mode === 'add' ? t('blockDialog.add') : t('blockDialog.save')}
      </Button>
    </DialogFooter>
  )
}
