import { useNavigate, type NavigateOptions } from '@tanstack/react-router'
import { useCallback, useState, type ReactElement } from 'react'
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
import { toast, toastError } from '@/lib/notifications/toast'

export type UseEntityDeleteOptions = {
  entityName: string
  listPath: NavigateOptions
  mutate: () => Promise<void>
  successMessage: string
  errorMessage?: string
  isPending?: boolean
}

export type UseEntityDeleteResult = {
  isOpen: boolean
  open: () => void
  close: () => void
  confirm: () => Promise<void>
  isPending: boolean
  dialog: ReactElement
}

export function useEntityDelete({
  entityName,
  listPath,
  mutate,
  successMessage,
  errorMessage,
  isPending = false,
}: UseEntityDeleteOptions): UseEntityDeleteResult {
  const { t } = useTranslation('entity-page')
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  const confirm = useCallback(async () => {
    try {
      await mutate()
      toast.success(successMessage)
      setIsOpen(false)
      await navigate(listPath)
    } catch {
      toastError(errorMessage ?? t('error.title'))
    }
  }, [mutate, navigate, listPath, successMessage, errorMessage, t])

  const dialog = (
    <AlertDialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('delete.title', { name: entityName })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('delete.message', { name: entityName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={close}>{t('actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="danger"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault()
              void confirm()
            }}
          >
            {t('delete.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { isOpen, open, close, confirm, isPending, dialog }
}
