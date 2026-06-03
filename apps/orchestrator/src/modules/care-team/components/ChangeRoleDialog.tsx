import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { ROLES_IN_CARE } from '../constants'
import { useChangeParticipantRole } from '../hooks'
import type { ParticipantRow, RoleInCare } from '../types'

export interface ChangeRoleDialogProps {
  open: boolean
  careTeamId: string
  patientId: string
  participant: ParticipantRow | null
  onOpenChange: (open: boolean) => void
}

export function ChangeRoleDialog({
  open,
  careTeamId,
  patientId,
  participant,
  onOpenChange,
}: ChangeRoleDialogProps): ReactElement {
  const { t } = useTranslation('care-teams-ui')
  const mutation = useChangeParticipantRole()
  const [roleInCare, setRoleInCare] = useState<RoleInCare>(
    participant?.role_in_care ?? 'consulting',
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!participant) return
    try {
      await mutation.mutateAsync({
        careTeamId,
        userId: participant.user_id,
        patientId,
        payload: { role_in_care: roleInCare },
      })
      toast.success(t('changeRoleDialog.toast.success'))
      onOpenChange(false)
    } catch {
      toast.error(t('changeRoleDialog.toast.error'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('changeRoleDialog.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label>{t('changeRoleDialog.role')}</Label>
            <Select
              value={roleInCare}
              onValueChange={(v) => setRoleInCare(v as RoleInCare)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES_IN_CARE.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`roleInCare.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('changeRoleDialog.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {t('changeRoleDialog.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
