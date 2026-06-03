import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PractitionerPicker, PractitionerRolePicker } from '@/components/pickers'
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
import { api } from '@/lib/api/client'

import { ROLES_IN_CARE } from '../constants'
import { useAddParticipant } from '../hooks'
import type { RoleInCare } from '../types'

export interface AddParticipantDialogProps {
  open: boolean
  careTeamId: string
  patientId: string
  onOpenChange: (open: boolean) => void
}

export function AddParticipantDialog({
  open,
  careTeamId,
  patientId,
  onOpenChange,
}: AddParticipantDialogProps): ReactElement {
  const { t } = useTranslation('care-teams-ui')
  const mutation = useAddParticipant()

  const [userId, setUserId] = useState<string | null>(null)
  const [practitionerId, setPractitionerId] = useState<string | null>(null)
  const [roleId, setRoleId] = useState<string | null>(null)
  const [roleInCare, setRoleInCare] = useState<RoleInCare>('consulting')

  const handleUserChange = async (id: string | null) => {
    setUserId(id)
    setRoleId(null)
    if (!id) {
      setPractitionerId(null)
      return
    }
    const { data } = await api.GET('/practitioners/{user_id}', {
      params: { path: { user_id: id } },
    })
    setPractitionerId(data?.id ?? null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    try {
      await mutation.mutateAsync({
        careTeamId,
        patientId,
        payload: {
          user_id: userId,
          role_in_care: roleInCare,
          acting_as_practitioner_role_id: roleId,
        },
      })
      toast.success(t('addDialog.toast.success'))
      onOpenChange(false)
    } catch {
      toast.error(t('addDialog.toast.error'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addDialog.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label>{t('addDialog.user')}</Label>
            <PractitionerPicker
              value={userId}
              onChange={(id) => void handleUserChange(id)}
              hasPractitioner
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>{t('addDialog.role')}</Label>
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
          <div className="flex flex-col gap-1">
            <Label>{t('addDialog.actingAs')}</Label>
            <PractitionerRolePicker
              practitionerId={practitionerId}
              value={roleId}
              onChange={(id) => setRoleId(id)}
              disabled={!practitionerId}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('addDialog.cancel')}
            </Button>
            <Button type="submit" disabled={!userId || mutation.isPending}>
              {t('addDialog.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
