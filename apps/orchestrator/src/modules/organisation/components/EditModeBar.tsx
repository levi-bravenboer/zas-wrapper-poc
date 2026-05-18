import { Keyboard, Save, X } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/style/cn'

import { PENDING_MOVES_MAX } from '../schemas'

export interface EditModeBarProps {
  pendingCount: number
  visible: boolean
  isSaving: boolean
  onSave: () => void
  onCancel: () => void
  className?: string
}

export function EditModeBar({
  pendingCount,
  visible,
  isSaving,
  onSave,
  onCancel,
  className,
}: EditModeBarProps): ReactElement {
  const { t } = useTranslation('organisations-admin-ui')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const tooMany = pendingCount > PENDING_MOVES_MAX
  const saveDisabled = pendingCount === 0 || tooMany || isSaving

  const handleCancel = (): void => {
    if (pendingCount > 0) {
      setConfirmOpen(true)
      return
    }
    onCancel()
  }

  return (
    <>
      <div
        role="region"
        aria-live="polite"
        data-slot="organisation-edit-mode-bar"
        data-visible={visible ? 'true' : 'false'}
        className={cn(
          'sticky bottom-0 z-20 mt-2 flex flex-wrap items-center gap-3 rounded-md border border-border bg-background px-3 py-2 shadow-md',
          'transition-all duration-200 ease-out',
          visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
          className,
        )}
      >
        <span className="text-sm font-medium">
          {t(pendingCount === 1 ? 'tree.edit.bar.count.one' : 'tree.edit.bar.count.other', {
            count: pendingCount,
          })}
        </span>
        <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
          <Keyboard aria-hidden="true" className="size-3.5" />
          {t('tree.edit.bar.hint')}
        </span>
        {tooMany && (
          <span className="text-xs text-destructive">
            {t('tree.edit.bar.too_many', { max: PENDING_MOVES_MAX })}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
            <X aria-hidden="true" className="size-4" />
            {t('tree.edit.bar.cancel')}
          </Button>
          <Button type="button" size="sm" onClick={onSave} disabled={saveDisabled}>
            <Save aria-hidden="true" className="size-4" />
            {t('tree.edit.bar.save')}
          </Button>
        </div>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tree.edit.discard.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('tree.edit.discard.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('tree.edit.discard.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              onClick={() => {
                setConfirmOpen(false)
                onCancel()
              }}
            >
              {t('tree.edit.discard.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
