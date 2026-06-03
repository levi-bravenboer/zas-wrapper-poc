import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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

import { useUnassignParticipant } from '../hooks'

export interface RemoveParticipantConfirmProps {
  open: boolean
  careTeamId: string
  patientId: string
  userId: string
  displayName: string
  onOpenChange: (open: boolean) => void
}

export function RemoveParticipantConfirm({
  open,
  careTeamId,
  patientId,
  userId,
  displayName,
  onOpenChange,
}: RemoveParticipantConfirmProps): ReactElement {
  const { t } = useTranslation('care-teams-ui')
  const mutation = useUnassignParticipant()

  const handleConfirm = async () => {
    try {
      await mutation.mutateAsync({ careTeamId, userId, patientId })
      toast.success(t('removeConfirm.toast.success'))
      onOpenChange(false)
    } catch {
      toast.error(t('removeConfirm.toast.error'))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('removeConfirm.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('removeConfirm.message', { name: displayName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('removeConfirm.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void handleConfirm()
            }}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t('removeConfirm.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
