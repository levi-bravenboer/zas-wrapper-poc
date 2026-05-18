import { useBlocker } from '@tanstack/react-router'
import { useCallback, useRef, type ReactElement } from 'react'
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

export type UseDirtyGuardOptions = {
  isDirty: boolean
}

export type UseDirtyGuardResult = {
  dialog: ReactElement
  dismiss: () => void
}

export function useDirtyGuard({ isDirty }: UseDirtyGuardOptions): UseDirtyGuardResult {
  const { t } = useTranslation('entity-page')
  const skipNext = useRef(false)

  const resolver = useBlocker({
    shouldBlockFn: () => {
      if (skipNext.current) {
        skipNext.current = false
        return false
      }
      return isDirty
    },
    enableBeforeUnload: () => isDirty,
    withResolver: true,
  })

  const dismiss = useCallback(() => {
    skipNext.current = true
  }, [])

  const open = resolver.status === 'blocked'

  const dialog = (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && resolver.status === 'blocked') {
          resolver.reset()
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('dirty.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('dirty.message')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              if (resolver.status === 'blocked') resolver.reset()
            }}
          >
            {t('dirty.confirm')}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="danger"
            onClick={() => {
              if (resolver.status === 'blocked') resolver.proceed()
            }}
          >
            {t('dirty.discard')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { dialog, dismiss }
}
