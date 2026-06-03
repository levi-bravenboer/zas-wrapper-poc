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

import { useUpdateCareTeam } from '../hooks'

export interface CloseTeamConfirmProps {
  open: boolean
  careTeamId: string
  patientId: string
  teamName: string
  onOpenChange: (open: boolean) => void
}

export function CloseTeamConfirm({
  open,
  careTeamId,
  patientId,
  teamName,
  onOpenChange,
}: CloseTeamConfirmProps): ReactElement {
  const { t } = useTranslation('care-teams-ui')
  const mutation = useUpdateCareTeam()

  const handleConfirm = async () => {
    try {
      await mutation.mutateAsync({
        careTeamId,
        patientId,
        payload: { period_end: new Date().toISOString() },
      })
      toast.success(t('closeConfirm.toast.success'))
      onOpenChange(false)
    } catch {
      toast.error(t('closeConfirm.toast.error'))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('closeConfirm.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('closeConfirm.message', { name: teamName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('closeConfirm.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void handleConfirm()
            }}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t('closeConfirm.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
